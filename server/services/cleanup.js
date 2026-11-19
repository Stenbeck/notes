import { models } from '../models/index.js'
import { storage } from './storage.js'
import { readWorkspace } from './workspace.js'

const removeAttachments = async (Attachment, documentId) => {
	let removed = 0
	for (const { _id } of await Attachment.find({ documentId }, { _id: 1 }).lean()) {
		await storage().remove(_id)
		const result = await Attachment.deleteOne({ _id, documentId })
		removed += result.deletedCount
	}
	return removed
}

export const cleanupOrphans = async (db) => {
	const { Document, Attachment } = models(db)
	const ws = await readWorkspace(db)
	const cutoff = new Date(Date.now() - 24 * 3600000)
	const age = { updatedAt: { $lt: cutoff } }
	const result = { documents: 0, attachments: 0 }
	const candidates = Document.find(age, { _id: 1 }).lean().cursor()
	for await (const { _id } of candidates) {
		if (ws.nodes[_id]) continue
		const current = await readWorkspace(db)
		const filter = { _id, ...age }
		if (current.nodes[_id] || !await Document.exists(filter)) continue
		result.attachments += await removeAttachments(Attachment, _id)
		result.documents += (await Document.deleteOne(filter)).deletedCount
	}
	return result
}

export const purgeDetached = async (db, ids) => {
	const { Document, Attachment } = models(db)
	const ws = await readWorkspace(db)
	for (const id of ids) {
		if (ws.nodes[id]) continue
		await removeAttachments(Attachment, id)
		await Document.deleteOne({ _id: id })
	}
}
