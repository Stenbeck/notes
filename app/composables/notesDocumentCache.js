import * as Y from 'yjs'

export const queueDocumentEdit = async (db, id, update) => {
	const tx = db.transaction(['documentEdits', 'documentVersions'], 'readwrite')
	const versions = tx.objectStore('documentVersions')
	const version = await versions.get(id)
	const pending = await tx.objectStore('documentEdits').add({ id, update })
	await versions.put({ id, revision: version?.revision ?? -1, pending })
	await tx.done
}

export const writeDocumentCache = async (db, id, update, { revision, acknowledged } = {}) => {
	const tx = db.transaction(['documentCache', 'documentVersions', 'documentEdits'], 'readwrite')
	const cache = tx.objectStore('documentCache')
	const versions = tx.objectStore('documentVersions')
	const previous = await cache.get(id)
	const version = await versions.get(id)
	if (acknowledged != null) {
		const edits = tx.objectStore('documentEdits')
		const keys = await edits.index('document').getAllKeys(id)
		for (const key of keys) {
			if (key <= acknowledged) await edits.delete(key)
		}
	}
	const next = {
		id,
		revision: Math.max(version?.revision ?? -1, revision ?? -1),
		pending: version?.pending === acknowledged ? null : version?.pending ?? null
	}
	await cache.put(previous ? Y.mergeUpdates([previous, update]) : update, id)
	await versions.put(next)
	await tx.done
	return next
}

export const removeDocumentCache = async (db, id) => {
	const tx = db.transaction(['documentCache', 'documentVersions', 'documentEdits'], 'readwrite')
	const edits = tx.objectStore('documentEdits')
	for (const key of await edits.index('document').getAllKeys(id)) await edits.delete(key)
	await tx.objectStore('documentCache').delete(id)
	await tx.objectStore('documentVersions').delete(id)
	await tx.done
}

export const readDocumentCache = async (db, id) => {
	const tx = db.transaction(['documentCache', 'documentVersions', 'documentEdits'])
	const [snapshot, version, edits] = await Promise.all([
		tx.objectStore('documentCache').get(id),
		tx.objectStore('documentVersions').get(id),
		tx.objectStore('documentEdits').index('document').getAll(id)
	])
	await tx.done
	const updates = edits.map(edit => edit.update)
	if (snapshot) updates.unshift(snapshot)
	const update = updates.length > 1 ? Y.mergeUpdates(updates) : updates[0]
	return { update, version }
}

export const hasUnmergedDocumentChanges = (remote, local) => {
	const doc = new Y.Doc()
	try {
		Y.applyUpdate(doc, remote)
		const before = Y.encodeStateAsUpdate(doc)
		Y.applyUpdate(doc, local)
		const after = Y.encodeStateAsUpdate(doc)
		return before.length !== after.length || before.some((byte, index) => byte !== after[index])
	} finally {
		doc.destroy()
	}
}
