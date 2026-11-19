import { models } from '../models/index.js'
import { storage } from './storage.js'
import { readWorkspace } from './workspace.js'
export const cleanupOrphans = async (db) => {
	const ws = await readWorkspace(db)
	const cutoff = new Date(Date.now() - 24 * 3600000)
	const candidates = await models(db)
		.Document.find({ updatedAt: { $lt: cutoff } }, { _id: 1 })
		.lean()
	for (const row of candidates) {
		if (ws.nodes[row._id]) continue
		const current = await readWorkspace(db)
		if (current.nodes[row._id]) continue
		for (const file of await models(db).Attachment.find({ documentId: row._id }).lean()) {
			await storage().remove(file._id)
			await models(db).Attachment.deleteOne({ _id: file._id })
		}
		await models(db).Document.deleteOne({ _id: row._id, updatedAt: { $lt: cutoff } })
	}
}
export const purgeDetached = async (db, ids) => {
	const ws = await readWorkspace(db)
	for (const id of ids) {
		if (ws.nodes[id]) continue
		for (const file of await models(db).Attachment.find({ documentId: id }).lean()) {
			await storage().remove(file._id)
			await models(db).Attachment.deleteOne({ _id: file._id })
		}
		await models(db).Document.deleteOne({ _id: id })
	}
}
