import { configuration } from '../config/index.js'
import { models } from '../models/index.js'
import { purgeDetached } from './cleanup.js'
import * as Y from 'yjs'
import { makeYDoc, toJSON, textOf } from './documents.js'
import { BSON } from 'mongodb'
import { randomUUID } from 'node:crypto'
import { readWorkspace, mutateWorkspace, assertAccess } from './workspace.js'
import { createDocument, syncDocument, replaceContent } from './documents.js'
import { safeWorkspace, projectOf, effectiveShare, descendants } from '../../shared/utils/structure.js'
import { passwordHash } from './shares.js'
import { storage } from './storage.js'
import { fail } from '../utils/publicError.js'
import { referencedFiles } from '../../shared/utils/attachments.js'
const visible = (ws, actor) =>
	actor.type === 'owner'
		? ws
		: {
				...ws,
				projects: ws.projects.filter((id) => actor.projects.includes(id)),
				nodes: Object.fromEntries(
					Object.entries(ws.nodes).filter(([id]) => actor.projects.includes(projectOf(ws, id)))
				),
				preferences: {},
				settings: {},
				operations: []
			}
export const manifest = async (db, actor) => {
	const ws = visible(await readWorkspace(db), actor)
	const documents = await models(db)
		.Document.find(
			{
				_id: {
					$in: Object.values(ws.nodes)
						.filter((n) => n.kind === 'document')
						.map((n) => n.id)
				}
			},
			{ _id: 1, revision: 1, updatedAt: 1 }
		)
		.lean()
	for (const row of documents) {
		const node = ws.nodes[row._id]
		const updated = row.updatedAt?.toISOString()
		if (node && updated && updated > node.updatedAt) node.updatedAt = updated
	}
	return { workspace: safeWorkspace(ws), documents }
}
export const structureOperation = async (db, op, actor, initialJSON) => {
	if (!op || typeof op.type !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(op.operationId || ''))
		fail('invalidOperation')
	const validId = (value) =>
		typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
	if (op.id && !validId(op.id)) fail('invalidInput')
	if (op.parentId && !validId(op.parentId)) fail('invalidInput')
	if (op.index !== undefined && (!Number.isInteger(op.index) || op.index < 0)) fail('invalidInput')
	if (op.baseRevision !== undefined && (!Number.isInteger(op.baseRevision) || op.baseRevision < 0))
		fail('invalidInput')
	if (op.type === 'preferences') {
		const allowed = {
			theme: ['notes', 'mood', 'offlist'],
			appearance: ['light', 'dark', 'system'],
			locale: ['sv', 'en'],
			dateFormat: ['yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy'],
			timeFormat: ['24h', '12h']
		}
		if (!op.values || Object.entries(op.values).some(([key, value]) => key === 'sidebarWidth' ? !Number.isInteger(value) || value < 179 || value > 560 : !allowed[key]?.includes(value)))
			fail('invalidInput')
	}
	if (op.type === 'trash.empty' && (!Array.isArray(op.ids) || !op.ids.length || op.ids.some((id) => !validId(id)) || new Set(op.ids).size !== op.ids.length)) fail('invalidInput')
	if (op.type === 'document.create') {
		const ws = await readWorkspace(db)
		assertAccess(ws, op.parentId, actor)
		await createDocument(db, op.id, initialJSON)
	}
	if (op.type === 'share') {
		if (actor.type !== 'owner') fail('forbidden', 403)
		if (op.password !== undefined) {
			if (typeof op.password !== 'string' || op.password.length > 200) fail('invalidInput')
			op.passwordHash = op.password ? await passwordHash(op.password) : null
		}
		delete op.password
	} else delete op.passwordHash
	const beforePurge = op.type === 'purge' ? await readWorkspace(db) : null
	const purgeIds = op.type === 'trash.empty' ? op.ids : beforePurge ? [op.id, ...descendants(beforePurge, op.id)] : []
	const result = await mutateWorkspace(db, op, actor)
	if (purgeIds.length) await purgeDetached(db, purgeIds)
	return safeWorkspace(visible(result, actor))
}
export const authorizedDocument = async (db, id, actor, write = false) => {
	const ws = await readWorkspace(db)
	const node = ws.nodes[id]
	if (!node || node.kind !== 'document') fail('notFound', 404)
	assertAccess(ws, id, actor, write)
	return { ws, node }
}
export const readDocuments = async (db, ids, actor, workspace) => {
	const ws = workspace || await readWorkspace(db)
	for (const id of ids) {
		if (ws.nodes[id]?.kind !== 'document') fail('notFound', 404)
		assertAccess(ws, id, actor, false)
	}
	if (!ids.length) return []
	const rows = await models(db).Document.find({ _id: { $in: ids } }).lean()
	const byId = new Map(rows.map((row) => [row._id, row]))
	return ids.map((id) => {
		const row = byId.get(id)
		if (!row) fail('notFound', 404)
		return {
			id,
			revision: row.revision,
			json: row.json,
			text: row.text,
			update: Buffer.from(row.state.buffer || row.state).toString('base64')
		}
	})
}
export const readDocument = async (db, id, actor) => (await readDocuments(db, [id], actor))[0]
export const updateDocument = async (db, id, body, actor) => {
	const { node } = await authorizedDocument(db, id, actor, true)
	if (node.status !== 'active') fail('documentRemoved', 409)
	return body.json
		? replaceContent(db, id, body.json, body.baseRevision)
		: syncDocument(db, id, body.update || '', body.vector)
}
export const searchDocuments = async (db, query, actor, includeInactive = false) => {
	const ws = visible(await readWorkspace(db), actor)
	const q = String(query || '')
		.toLocaleLowerCase()
		.slice(0, 200)
	const nodes = Object.values(ws.nodes).filter(
		(n) => n.kind === 'document' && (includeInactive || n.status === 'active')
	)
	const rows = await models(db)
		.Document.find({ _id: { $in: nodes.map((n) => n.id) } }, { _id: 1, text: 1 })
		.lean()
	const texts = new Map(rows.map((row) => [row._id, row.text]))
	return nodes
		.filter((n) => `${n.title} ${texts.get(n.id) || ''}`.toLocaleLowerCase().includes(q))
		.slice(0, 200)
		.map((n) => ({ id: n.id, title: n.title, snippet: (texts.get(n.id) || '').slice(0, 150) }))
}
const uploadTasks = new WeakMap()
const appendAttachment = async (db, documentId, file) => {
	for (let attempt = 0; attempt < 8; attempt++) {
		const row = await models(db).Document.findOne({ _id: documentId }).lean()
		if (!row) fail('notFound', 404)
		if (referencedFiles(row.json).has(file._id)) return
		const doc = new Y.Doc()
		const incoming = makeYDoc({ type: 'doc', content: [file.type.startsWith('image/')
			? { type: 'image', attrs: { src: `/api/files/${file._id}`, alt: file.name } }
			: { type: 'attachment', attrs: { id: file._id, name: file.name } }] })
		try {
			Y.applyUpdate(doc, new Uint8Array(row.state.buffer || row.state))
			const fragment = doc.getXmlFragment('default')
			fragment.insert(fragment.length, incoming.getXmlFragment('default').toArray().map((node) => node.clone()))
			const json = toJSON(doc)
			const next = { revision: row.revision + 1, state: Buffer.from(Y.encodeStateAsUpdate(doc)), json, text: textOf(json) }
			if (BSON.calculateObjectSize({ ...row, ...next }) > 12 * 1024 * 1024) fail('documentTooLarge', 413)
			const result = await models(db).Document.updateOne({ _id: documentId, revision: row.revision }, { $set: next }, { runValidators: true })
			if (result.modifiedCount) return
		} finally {
			doc.destroy()
			incoming.destroy()
		}
	}
	fail('documentConflict', 409)
}
export const uploadAttachment = async (db, documentId, part, actor, uploadId) => {
	const { node } = await authorizedDocument(db, documentId, actor, true)
	if (node.status !== 'active' || !part?.data || part.data.length > configuration().maxFileSize) fail('attachmentTooLarge', 413)
	if (uploadId && !/^[a-f0-9-]{36}$/i.test(uploadId)) fail('invalidInput')
	const id = uploadId || randomUUID()
	let tasks = uploadTasks.get(db)
	if (!tasks) { tasks = new Map()
		uploadTasks.set(db, tasks)
	}
	const run = async () => {
		let file = await models(db).Attachment.findOne({ _id: id }).lean()
		if (file && file.documentId !== documentId) fail('forbidden', 403)
		if (!file) {
			file = { _id: id, documentId, name: String(part.filename || 'File').replace(/[\r\n/\\]/g, '_').slice(0, 200), type: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(part.type) ? part.type : 'application/octet-stream', size: part.data.length }
			try { await storage().put(id, part.data) }
			catch (error) {
				if (error.code !== 'EEXIST' || !(await storage().get(id)).equals(part.data)) throw error
			}
			try { await models(db).Attachment.create(file) }
			catch (error) {
				if (error.code !== 11000) throw error
				file = await models(db).Attachment.findOne({ _id: id }).lean()
				if (file.documentId !== documentId) fail('forbidden', 403)
			}
		}
		await appendAttachment(db, documentId, file)
		return { id, name: file.name, type: file.type, url: `/api/files/${id}` }
	}
	if (tasks.has(id)) {
		const result = await tasks.get(id)
		const file = await models(db).Attachment.findOne({ _id: id }).lean()
		if (file.documentId !== documentId) fail('forbidden', 403)
		return result
	}
	const task = run()
	tasks.set(id, task)
	try { return await task }
	finally { tasks.delete(id) }
}

export const changeSummary = async (db) => {
	const workspace = await models(db).Workspace.findOne({ _id: 'main' }, { revision: 1 }).lean()
	const documents = await models(db).Document.find({}, { _id: 1, revision: 1, updatedAt: 1 }).lean()
	return { revision: workspace?.revision || 0, documents }
}
