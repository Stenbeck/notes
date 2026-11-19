import { models } from '../models/index.js'
import { authorizedDocument } from './operations.js'
import { authorizeMcp } from './oauth.js'
import { authorizeToken, tokenType } from './tokens.js'
import { resolveShare } from './shares.js'
import { storage } from './storage.js'
import { readWorkspace } from './workspace.js'
import { referencedFiles } from '../../shared/utils/attachments.js'
import { fail } from '../utils/publicError.js'

export const readAttachment = async (db, id, { slug, cookies, bearer, owner }) => {
	const file = await models(db).Attachment.findOne({ _id: id }).lean()
	if (!file || file.deletedAt) fail('notFound', 404)
	if (slug) {
		const result = await resolveShare(db, slug, file.documentId, cookies)
		if (result.locked) fail('forbidden', 403)
	} else {
		const actor = bearer ? (bearer.startsWith('notes_oauth_') ? await authorizeMcp(db, bearer) : await authorizeToken(db, bearer, await tokenType(db, bearer))) : await owner()
		await authorizedDocument(db, file.documentId, actor)
	}
	return { file, bytes: await storage().get(file._id) }
}

const requireFileOwner = (actor) => {
	if (actor?.type !== 'owner') fail('forbidden', 403)
}
export const listAttachments = async (db, actor) => {
	requireFileOwner(actor)
	const ws = await readWorkspace(db)
	const ids = Object.values(ws.nodes).filter((node) => node.kind === 'document').map((node) => node.id)
	const docs = await models(db).Document.find({ _id: { $in: ids } }, { _id: 1, json: 1 }).lean()
	const references = new Map()
	for (const doc of docs)
		for (const id of referencedFiles(doc.json)) {
			if (!references.has(id)) references.set(id, [])
			references.get(id).push({ id: doc._id, title: ws.nodes[doc._id].title })
		}
	const files = await models(db).Attachment.find({ documentId: { $in: ids } }).lean()
	return files.map((file) => ({
		id: file._id, name: file.name, type: file.type, size: file.size,
		createdAt: file.createdAt || null, deleted: !!file.deletedAt, deletionPending: !!file.deletedAt && !file.purgedAt,
		documentId: file.documentId, references: references.get(file._id) || []
	}))
}
export const deleteAttachment = async (db, id, actor) => {
	requireFileOwner(actor)
	const file = await models(db).Attachment.findOne({ _id: id }).lean()
	if (!file) fail('notFound', 404)
	await authorizedDocument(db, file.documentId, actor)
	// Keep metadata as a tombstone so existing and offline references stay intelligible.
	await models(db).Attachment.updateOne({ _id: id, deletedAt: null }, { $set: { deletedAt: new Date() } })
	await storage().remove(id)
	await models(db).Attachment.updateOne({ _id: id }, { $set: { purgedAt: new Date() } })
	return { id }
}
