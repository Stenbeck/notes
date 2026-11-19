import * as Y from 'yjs'
import { yDocToProsemirrorJSON } from '@tiptap/y-tiptap'
import { IndexeddbPersistence } from 'y-indexeddb'
import { openDB, deleteDB } from 'idb'
import { hasUnmergedDocumentChanges, queueDocumentEdit, readDocumentCache, removeDocumentCache, writeDocumentCache } from './notesDocumentCache.js'
import {
	ancestors,
	childrenOf,
	effectiveShare,
	projectOf,
	descendants
} from '../../shared/utils/structure.js'

let cachePromise,
	busy = false,
	timer,
	interval
const documents = new Map()
let suspended = false
let resyncRequested = false
let forceRefreshRequested = false
let eventHandlers = []
let navigationSequence = 0
const getCache = () =>
	(cachePromise ||= openDB('notes-local', 2, {
		upgrade: (db, oldVersion) => {
			if (oldVersion < 1) {
				db.createObjectStore('state')
				db.createObjectStore('operations', { keyPath: 'operationId' })
				db.createObjectStore('uploads', { keyPath: 'id' })
			}
			db.createObjectStore('documentCache')
			db.createObjectStore('documentVersions', { keyPath: 'id' })
			db.createObjectStore('documentEdits', { autoIncrement: true }).createIndex('document', 'id')
		}
	}))
const bytesToBase64 = (bytes) => {
	let text = ''
	for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192))
	return btoa(text)
}
const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))
export const useNotes = () => {
	const state = useState('notes', () => ({
		workspace: { revision: 0, projects: [], nodes: {}, preferences: {}, settings: {} },
		user: null,
		view: 'start',
		selected: null,
		sync: 'loading',
		error: '',
		query: '',
		ready: false,
		panel: null,
		expanded: [],
		mobile: false,
		searchResults: [],
		integrationTokens: [],
		importTask: { phase: 'idle', fileName: '', preview: null, result: null, pendingIds: [], error: '' },
		pendingUploads: 0
	}))
	const { t, setLocale } = useI18n()
	const { ask } = useConfirmation()
	const router = useRouter()
	const { request, abortRequests } = useNotesRequest()
	const save = async () =>
		(await getCache()).put(
			'state',
			{
				workspace: JSON.parse(JSON.stringify(state.value.workspace)),
				user: JSON.parse(JSON.stringify(state.value.user))
			},
			'manifest'
		)
	const applyAppearance = () => {
		const preferences = state.value.workspace.preferences || {}
		document.documentElement.dataset.theme = preferences.theme || 'notes'
		document.documentElement.dataset.appearance = preferences.appearance || 'system'
		if (preferences.locale) setLocale(preferences.locale)
	}
	const refresh = async () => {
		const manifest = await request('manifest')
		if (suspended) return
		state.value.workspace = manifest.workspace
		state.value.user = manifest.user
		await save()
		applyAppearance()
		return manifest
	}
	const cacheDocument = async (id) => {
		if (documents.has(id)) return documents.get(id).doc
		const db = await getCache()
		const { update, version } = await readDocumentCache(db, id)
		if (documents.has(id)) return documents.get(id).doc
		const doc = new Y.Doc()
		if (update) Y.applyUpdate(doc, update, 'remote')
		const item = { doc, dirty: !!version?.pending, pull: !version || version.revision < 0, revision: version?.revision ?? -1 }
		documents.set(id, item)
		doc.on('update', (change, origin) => {
			if (origin === 'remote') return
			item.dirty = true
			item.persisting = queueDocumentEdit(db, id, change).catch(() => {
				state.value.sync = 'error'
				state.value.error = 'serverError'
			})
			state.value.sync = 'local'
			clearTimeout(timer)
			timer = setTimeout(sync, 500)
		})
		return doc
	}
	const migrateDocumentCache = async (cached) => {
		const db = await getCache()
		if (await db.get('state', 'documentCacheMigrated')) return
		const prefix = 'notes-doc-'
		const ids = typeof indexedDB.databases === 'function'
			? (await indexedDB.databases()).map(({ name }) => name).filter(name => name?.startsWith(prefix)).map(name => name.slice(prefix.length))
			: Object.values(cached?.workspace.nodes || {}).filter(node => node.kind === 'document').map(node => node.id)
		for (const id of ids) {
			if (await db.get('documentVersions', id)) {
				await deleteDB(prefix + id)
				continue
			}
			const doc = new Y.Doc()
			const persistence = new IndexeddbPersistence(prefix + id, doc)
			await persistence.whenSynced
			const update = Y.encodeStateAsUpdate(doc)
			if (update.length > 2) {
				const status = state.value.workspace.nodes[id]?.status
				if (status === 'active')
					await queueDocumentEdit(db, id, update)
				else await writeDocumentCache(db, id, update)
			}
			await persistence.destroy()
			doc.destroy()
			await deleteDB(prefix + id)
		}
		await db.put('state', true, 'documentCacheMigrated')
	}
	const prepareDocuments = async (remote = []) => {
		const versions = new Map((await (await getCache()).getAll('documentVersions')).map(row => [row.id, row]))
		for (const [id, version] of versions) {
			if (version.pending) {
				await cacheDocument(id)
				documents.get(id).dirty = true
			}
		}
		for (const row of remote) {
			const node = state.value.workspace.nodes[row._id]
			if (node?.status !== 'active' || (versions.get(row._id)?.revision ?? -1) >= row.revision) continue
			await cacheDocument(row._id)
			documents.get(row._id).pull = true
		}
	}
	const persistImportTask = async () => (await getCache()).put('state', JSON.parse(JSON.stringify(state.value.importTask)), 'importTask')
	const finishImport = async (result) => {
		Object.assign(state.value.importTask, { phase: 'syncing', result, preview: null, pendingIds: [...result.documentIds], error: '' })
		await persistImportTask()
		await sync(true)
	}
	const openDocument = async (id) => {
		if (state.value.selected !== id || state.value.view !== 'document') navigationSequence++
		state.value.selected = id
		state.value.view = 'document'
		state.value.mobile = false
		const path = `/doc/${encodeURIComponent(id)}`
		if (router.currentRoute.value.path !== path) {
			if (router.currentRoute.value.query.document) router.replace(path)
			else router.push(path)
		}
		const doc = await cacheDocument(id)
		if (navigator.onLine) await sync()
		return doc
	}
	const getDocumentSnapshot = async (id) => {
		if (state.value.workspace.nodes[id]?.kind !== 'document') throw Object.assign(new Error('notFound'), { code: 'notFound' })
		const local = documents.get(id)
		const cached = local ? null : await readDocumentCache(await getCache(), id)
		const snapshot = new Y.Doc()
		try {
			if (navigator.onLine) {
				const remote = await request(`documents/${id}`)
				Y.applyUpdate(snapshot, fromBase64(remote.update))
			} else if (local ? local.revision < 0 && !local.dirty : !cached.update) {
				throw Object.assign(new Error('documentUnavailableOffline'), { code: 'documentUnavailableOffline' })
			}
			// Merge local edits into an isolated snapshot without navigating or mutating the editor.
			if (local) Y.applyUpdate(snapshot, Y.encodeStateAsUpdate(local.doc))
			else if (cached.update) Y.applyUpdate(snapshot, cached.update)
			return yDocToProsemirrorJSON(snapshot, 'default')
		} finally {
			snapshot.destroy()
		}
	}

	const operation = async (values) => {
		const op = {
			...values,
			operationId: crypto.randomUUID(),
			queuedAt: Date.now(),
			baseRevision: state.value.workspace.revision
		}
		if (op.type === 'purge') op.localPurgeIds = [op.id, ...descendants(state.value.workspace, op.id)]
		if (op.type === 'trash.empty') op.localPurgeIds = [...op.ids]
		const db = await getCache()
		const tx = db.transaction(['state', 'operations'], 'readwrite')
		op.sequence = ((await tx.objectStore('state').get('queueSequence')) || 0) + 1
		op.baseRevision += await tx.objectStore('operations').count()
		await tx.objectStore('state').put(op.sequence, 'queueSequence')
		await tx.objectStore('operations').put(op)
		await tx.done
		state.value.sync = 'local'
		// Apply the same structure reducer locally; server permissions remain authoritative.
		const { applyLocalOperation } = await import('../../shared/utils/localStructure.js')
		applyLocalOperation(state.value.workspace, op)
		await save()
		await sync()
		return op.id
	}
	const sync = async (forceRefresh = false) => {
		if (suspended || !state.value.user) return
		if (busy) {
			resyncRequested = true
			forceRefreshRequested ||= forceRefresh
			return
		}
		if (!navigator.onLine) {
			state.value.sync = 'offline'
			return
		}
		busy = true
		forceRefresh ||= forceRefreshRequested || state.value.importTask.phase === 'syncing'
		forceRefreshRequested = false
		resyncRequested = false
		try {
			const db = await getCache()
			const queue = (await db.getAll('operations')).sort(
				(a, b) => (a.sequence || a.queuedAt) - (b.sequence || b.queuedAt)
			)
			const uploads = await db.getAll('uploads')
			if (!forceRefresh && !queue.length && !uploads.length && ![...documents.values()].some((item) => item.dirty || item.pull)) {
				if (!state.value.error) state.value.sync = 'synced'
				return
			}
			state.value.sync = 'syncing'
			for (const op of queue) {
				const next = { ...op }
				try {
					state.value.workspace = await request('operations', { method: 'POST', body: next })
					await db.delete('operations', op.operationId)
					if (op.type === 'purge' || op.type === 'trash.empty') {
						for (const id of op.localPurgeIds || [op.id]) {
							const item = documents.get(id)
							if (item) {
								item.doc.destroy()
								await item.persisting
								documents.delete(id)
							}
							await removeDocumentCache(db, id)
						}
						if ('caches' in window) await caches.delete('notes-private-files-v1')
					}
				} catch (error) {
					if (error.code === 'structureConflict' || error.code === 'confirmPublic') await refresh()
					throw error
				}
			}
			if (forceRefresh) {
				const manifest = await refresh()
				await prepareDocuments(manifest?.documents)
			}
			if (state.value.importTask.phase === 'syncing') {
				for (const id of state.value.importTask.pendingIds) {
					if (!state.value.workspace.nodes[id]) throw Object.assign(new Error('networkError'), { code: 'networkError' })
					await cacheDocument(id)
				}
			}
			for (const [id, item] of documents) {
				if (!item.dirty && !item.pull) continue
				await item.persisting
				const cached = await readDocumentCache(db, id)
				if (cached.update) Y.applyUpdate(item.doc, cached.update, 'remote')
				const acknowledged = cached.version?.pending
				const wsNode = state.value.workspace.nodes[id]
				if ((!wsNode || wsNode.status !== 'active') && item.dirty) {
					const outgoing = Y.encodeStateAsUpdate(item.doc)
					if (wsNode) {
						const latest = await request(`documents/${id}`)
						const remote = fromBase64(latest.update)
						if (!hasUnmergedDocumentChanges(remote, outgoing)) {
							Y.applyUpdate(item.doc, remote, 'remote')
							const version = await writeDocumentCache(db, id, remote, { revision: latest.revision, acknowledged })
							item.revision = latest.revision
							item.dirty = !!version.pending
							item.pull = false
							continue
						}
					}
					const recovered = crypto.randomUUID()
					state.value.workspace = await request('operations', {
						method: 'POST',
						body: {
							type: 'document.create',
							id: recovered,
							parentId: null,
							title: `${t('recovered')}: ${wsNode?.title || t('untitled')}`,
							operationId: crypto.randomUUID()
						}
					})
					await request(`documents/${recovered}`, {
						method: 'POST',
						body: { update: bytesToBase64(outgoing) }
					})
					const version = await writeDocumentCache(db, id, outgoing, { acknowledged })
					item.dirty = !!version.pending
					item.pull = false
					continue
				}
				if (!wsNode || wsNode.status !== 'active') {
					item.pull = false
					continue
				}
				const outgoing = item.dirty ? Y.encodeStateAsUpdate(item.doc) : null
				item.dirty = false
				item.pull = false
				try {
					const response = await request(`documents/${id}`, {
						method: 'POST',
						body: { update: outgoing ? bytesToBase64(outgoing) : '', vector: bytesToBase64(Y.encodeStateVector(item.doc)) }
					})
					const remoteUpdate = fromBase64(response.update)
					Y.applyUpdate(item.doc, remoteUpdate, 'remote')
					const update = outgoing ? Y.mergeUpdates([outgoing, remoteUpdate]) : remoteUpdate
					const version = await writeDocumentCache(db, id, update, { revision: response.revision, acknowledged })
					item.revision = response.revision
					item.dirty ||= !!version.pending
				} catch (error) {
					item.dirty = !!outgoing || item.dirty
					item.pull = true
					throw error
				}
			}
			for (const upload of uploads) {
				const form = new FormData()
				form.append('file', upload.file, upload.file.name)
				await request(`upload?documentId=${upload.documentId}&uploadId=${upload.id}`, {
					method: 'POST',
					body: form
				})
				await db.delete('uploads', upload.id)
				state.value.pendingUploads = await db.count('uploads')
				const latest = await request(`documents/${upload.documentId}`)
				const local = documents.get(upload.documentId)
				const update = fromBase64(latest.update)
				await writeDocumentCache(db, upload.documentId, update, { revision: latest.revision })
				if (local) {
					Y.applyUpdate(local.doc, update, 'remote')
					local.revision = latest.revision
				}
			}
			const latest = await refresh()
			if (state.value.importTask.phase === 'syncing') {
				const revisions = new Map(latest.documents.map((row) => [row._id, row.revision]))
				state.value.importTask.pendingIds = state.value.importTask.pendingIds.filter((id) => {
					const local = documents.get(id)
					const pending = !local || local.dirty || local.pull || local.revision < (revisions.get(id) ?? Infinity)
					if (pending && local) local.pull = true
					return pending
				})
				if (!state.value.importTask.pendingIds.length) state.value.importTask.phase = 'complete'
				await persistImportTask()
			}
			state.value.error = ''
			state.value.sync =
				(await db.count('operations')) ||
				(await db.count('uploads')) ||
				[...documents.values()].some((item) => item.dirty || item.pull)
					? 'local'
					: 'synced'
		} catch (error) {
			if (suspended) return
			if (error.code === 'unauthorized') {
				state.value.sync = 'error'
				state.value.error = 'sessionExpired'
			} else {
				state.value.sync = navigator.onLine ? 'error' : 'offline'
				state.value.error = navigator.onLine ? error.code : ''
			}
		} finally {
			busy = false
			if (
				!suspended &&
				(!state.value.error || (resyncRequested && state.value.error === 'networkError')) &&
				navigator.onLine &&
				(resyncRequested || forceRefreshRequested || state.value.importTask.phase === 'syncing' || [...documents.values()].some((item) => item.dirty) || (await (await getCache()).count('operations')))
			) {
				resyncRequested = false
				clearTimeout(timer)
				timer = setTimeout(sync, 500)
			}
		}
	}
	let checking = false
	const checkChanges = async () => {
		if (checking || busy || suspended || document.hidden || !navigator.onLine || !state.value.user) return
		checking = true
		try {
			const changes = await request('changes')
			let metadataChanged = false
			for (const remote of changes.documents) {
				const local = documents.get(remote._id)
				if (local && local.revision < remote.revision && state.value.workspace.nodes[remote._id]?.status === 'active') local.pull = true
				const node = state.value.workspace.nodes[remote._id]
				if (node && remote.updatedAt && remote.updatedAt > node.updatedAt) {
					node.updatedAt = remote.updatedAt
					metadataChanged = true
				}
			}
			if (metadataChanged) await save()
			if (changes.revision === state.value.workspace.revision) await prepareDocuments(changes.documents)
			await sync(changes.revision !== state.value.workspace.revision)
			if (!state.value.error || ['networkError', 'sessionExpired'].includes(state.value.error)) {
				state.value.error = ''
				if (state.value.sync === 'error' || state.value.sync === 'offline') state.value.sync = 'synced'
			}
		} catch (error) {
			if (!suspended) {
				state.value.sync = navigator.onLine ? 'error' : 'offline'
				state.value.error = error.code === 'unauthorized' ? 'sessionExpired' : error.code
			}
		} finally {
			checking = false
		}
	}
	const resume = async () => {
		await sync()
		await checkChanges()
	}
	const boot = async () => {
		suspended = false
		if (state.value.ready) return
		const storedImport = await (await getCache()).get('state', 'importTask')
		if (storedImport) {
			state.value.importTask = storedImport
			if (storedImport.phase === 'importing') {
				state.value.importTask.phase = 'uncertain'
				state.value.importTask.error = 'importUncertain'
			}
		}
		const cached = await (await getCache()).get('state', 'manifest')
		if (cached) {
			state.value.workspace = cached.workspace
			state.value.user = cached.user
			applyAppearance()
		}
		let manifest
		try {
			manifest = await refresh()
		} catch (error) {
			if (!cached || error.code === 'unauthorized' || error.status === 401) {
				const document = router.currentRoute.value.params.id || router.currentRoute.value.query.document
				await navigateTo({ path: '/login', query: { document } }, { replace: true })
				return
			}
		}
		await migrateDocumentCache(cached)
		await prepareDocuments(manifest?.documents)
		state.value.ready = true
		clearInterval(interval)
		interval = setInterval(checkChanges, 15000)
		for (const [name, handler] of eventHandlers) window.removeEventListener(name, handler)
		eventHandlers = [
			['online', resume],
			['focus', resume],
			['visibilitychange', resume],
			[
				'offline',
				() => {
					state.value.sync = 'offline'
				}
			]
		]
		for (const [name, handler] of eventHandlers) window.addEventListener(name, handler)
		await sync()
	}
	const create = async (parentId) => {
		const id = crypto.randomUUID()
		const share = effectiveShare(state.value.workspace, parentId)
		if (share && !await ask(t('confirmPublic'))) return
		await operation({
			type: 'document.create',
			id,
			parentId: parentId || null,
			title: t('untitled'),
			confirmPublic: !!share,
			shareVersion: share?.version
		})
		await openDocument(id)
	}
	const move = async (id, parentId, index) => {
		const currentPanel = state.value.panel
		const source = state.value.workspace.nodes[id]
		if (!source || parentId === id || descendants(state.value.workspace, id).includes(parentId)) {
			state.value.error = 'cycle'
			return
		}
		if (source.kind === 'project' && parentId) {
			state.value.error = 'projectNesting'
			return
		}
		if ((source.parentId || null) === (parentId || null) && index !== undefined && source.order < index)
			index--
		const next = effectiveShare(state.value.workspace, parentId)
		const old = effectiveShare(state.value.workspace, id)
		const confirmPublic = !!next && next.id !== old?.id
		if (confirmPublic && !await ask(t('confirmPublic'))) return
		await operation({
			type: 'node.move',
			id,
			parentId,
			index,
			confirmPublic,
			shareVersion: next?.version,
			shareId: next?.id
		})
		if (state.value.panel === currentPanel) state.value.panel = null
	}
	const searchLocal = async (query, includeInactive = false) => {
		const term = query.toLocaleLowerCase()
		const db = await getCache()
		const nodes = Object.values(state.value.workspace.nodes)
			.filter(node => node.kind === 'document' && (includeInactive || node.status === 'active'))
		const matches = []
		for (const node of nodes) {
			const loaded = documents.get(node.id)?.doc
			let text = loaded?.getXmlFragment('default').toString() || ''
			if (!loaded && !node.title.toLocaleLowerCase().includes(term)) {
				const { update } = await readDocumentCache(db, node.id)
				if (update) {
					const doc = new Y.Doc()
					try {
						Y.applyUpdate(doc, update)
						text = doc.getXmlFragment('default').toString()
					} finally {
						doc.destroy()
					}
				}
			}
			if (`${node.title} ${text}`.toLocaleLowerCase().includes(term)) matches.push({ id: node.id })
		}
		return matches
	}

	const resolveQueue = async (discard) => {
		const db = await getCache()
		const snapshot = structuredClone((await refresh()).workspace)
		const queue = (await db.getAll('operations')).sort(
			(a, b) => (a.sequence || a.queuedAt) - (b.sequence || b.queuedAt)
		)
		const exposesContent = queue.some(op => {
			if (!['node.move', 'document.create'].includes(op.type)) return false
			const destination = effectiveShare(snapshot, op.parentId)
			return destination && destination.id !== effectiveShare(snapshot, op.id)?.id
		})
		if (!discard && !await ask(t(exposesContent ? 'confirmPublic' : 'retryStructure'))) return
		for (const [index, op] of queue.entries()) {
			if (discard) await db.delete('operations', op.operationId)
			else {
				op.baseRevision = snapshot.revision + index
				const share = effectiveShare(snapshot, op.parentId)
				if (share && exposesContent) {
					op.confirmPublic = true
					op.shareVersion = share.version
					op.shareId = share.id
				}
				await db.put('operations', op)
			}
		}
		state.value.error = ''
		await sync()
	}
	const select = (view, id = null) => {
		navigationSequence++
		state.value.view = view
		state.value.selected = id
		state.value.mobile = false
		if (router.currentRoute.value.params.id || router.currentRoute.value.query.document) router.push({ path: '/' })
	}
	const upload = async (file) => {
		const id = crypto.randomUUID()
		await (await getCache()).put('uploads', { id, documentId: state.value.selected, file })
		state.value.pendingUploads = await (await getCache()).count('uploads')
		await sync()
	}
	const prepareReload = async () => {
		await Promise.all([...documents.values()].map(item => item.persisting))
		if (state.value.error) throw Object.assign(new Error('serverError'), { code: state.value.error })
		await save()
	}
	const logout = async () => {
		if (navigator.onLine) {
			const deadline = Date.now() + 10000
			while (busy && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50))
			await sync()
		}
		const queued =
			(await (await getCache()).count('operations')) + (await (await getCache()).count('uploads'))
		if (
			(queued || state.value.importTask.phase === 'syncing' || [...documents.values()].some((item) => item.dirty)) &&
			!await ask(t('unsyncedLogout'))
		)
			return
		suspended = true
		clearTimeout(timer)
		abortRequests()
		for (const [name, handler] of eventHandlers) window.removeEventListener(name, handler)
		eventHandlers = []
		await $fetch('/api/auth/sign-out', { method: 'POST', body: {} })
		clearInterval(interval)
		for (const item of documents.values()) {
			await item.persisting
			item.doc.destroy()
		}
		documents.clear()
		const db = await getCache()
		db.close()
		await deleteDB('notes-local')
		if ('caches' in window) await caches.delete('notes-private-files-v1')
		cachePromise = null
		state.value.ready = false
		state.value.user = null
		state.value.workspace = { revision: 0, projects: [], nodes: {}, settings: {}, preferences: {} }
		state.value.view = 'start'
		state.value.selected = null
		state.value.panel = null
		state.value.error = ''
		state.value.expanded = []
		state.value.query = ''
		state.value.importTask = { phase: 'idle', fileName: '', preview: null, result: null, pendingIds: [], error: '' }
		await navigateTo('/login')
	}
	return {
		state,
		request,
		persistImportTask,
		finishImport,
		refresh,
		searchLocal,
		resolveQueue,
		boot,
		prepareReload,
		sync,
		operation,
		create,
		move,
		select,
		openDocument,
		getDocumentSnapshot,
		getNavigationVersion: () => navigationSequence,
		upload,
		logout,
		applyAppearance,
		ancestors,
		childrenOf,
		effectiveShare,
		projectOf
	}
}
