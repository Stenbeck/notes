import { models } from '../models/index.js'
import * as Y from 'yjs'
import { prosemirrorJSONToYDoc, prosemirrorToYXmlFragment, yDocToProsemirrorJSON } from '@tiptap/y-tiptap'
import { BSON } from 'mongodb'
import { schema } from '../../shared/editor/schema.js'
import { fail } from '../utils/publicError.js'
const documentContent = ({ revision, state, json, text }) => ({ revision, state, json, text })

export const blankJSON = () => ({ type: 'doc', content: [{ type: 'paragraph' }] })
export const makeYDoc = (json) => prosemirrorJSONToYDoc(schema(), json || blankJSON(), 'default')
export const toJSON = (doc) => {
	const json = yDocToProsemirrorJSON(doc, 'default')
	if (!json.content?.length) return blankJSON()
	const node = schema().nodeFromJSON(json)
	node.check()
	return node.toJSON()
}
export const textOf = (json) =>
	[json.text || '', ...(json.content || []).map(textOf)].filter(Boolean).join(' ')
export const createDocument = async (db, id, json) => {
	const doc = makeYDoc(json)
	try {
		const content = toJSON(doc)
		const row = {
			_id: id,
			revision: 0,
			state: Buffer.from(Y.encodeStateAsUpdate(doc)),
			json: content,
			text: textOf(content)
		}
		if (BSON.calculateObjectSize(row) > 12 * 1024 * 1024) fail('documentTooLarge', 413)
		await models(db).Document.create(row)
	} catch (error) {
		if (error.code !== 11000) throw error
	} finally {
		doc.destroy()
	}
}
export const syncDocument = async (db, id, update, vector) => {
	if (typeof update !== 'string' || update.length > 18 * 1024 * 1024) fail('invalidUpdate')
	for (let attempt = 0; attempt < 8; attempt++) {
		const row = await models(db).Document.findOne({ _id: id }).lean()
		if (!row) fail('notFound', 404)
		const doc = new Y.Doc()
		try {
			Y.applyUpdate(doc, new Uint8Array(row.state.buffer || row.state))
			if (update) Y.applyUpdate(doc, Buffer.from(update, 'base64'))
			const state = Buffer.from(Y.encodeStateAsUpdate(doc))
			const changed = !!update && !state.equals(Buffer.from(row.state.buffer || row.state))
			if (!changed) return {
				revision: row.revision,
				update: Buffer.from(Y.encodeStateAsUpdate(doc, vector ? Buffer.from(vector, 'base64') : undefined)).toString('base64')
			}
			const json = toJSON(doc)
			const next = {
				...row,
				revision: row.revision + 1,
				state,
				json,
				text: textOf(json)
			}
			if (BSON.calculateObjectSize(next) > 12 * 1024 * 1024) fail('documentTooLarge', 413)
			const response = await models(db).Document.updateOne(
				{ _id: id, revision: row.revision },
				{ $set: documentContent(next) },
				{ runValidators: true }
			)
			if (response.modifiedCount)
				return {
					revision: next.revision,
					update: Buffer.from(
						Y.encodeStateAsUpdate(doc, vector ? Buffer.from(vector, 'base64') : undefined)
					).toString('base64')
				}
		} finally {
			doc.destroy()
		}
	}
	fail('documentConflict', 409)
}
export const replaceContent = async (db, id, json, revision) => {
	const row = await models(db).Document.findOne({ _id: id }).lean()
	if (!row) fail('notFound', 404)
	if (row.revision !== revision) fail('documentConflict', 409)
	const doc = new Y.Doc()
	try {
		Y.applyUpdate(doc, new Uint8Array(row.state.buffer || row.state))
		const node = schema().nodeFromJSON(json || blankJSON())
		// Update the existing fragment so typed attributes and unchanged CRDT nodes are preserved.
		prosemirrorToYXmlFragment(node, doc.getXmlFragment('default'))
		const content = toJSON(doc)
		const next = {
			...row,
			state: Buffer.from(Y.encodeStateAsUpdate(doc)),
			json: content,
			text: textOf(content),
			revision: row.revision + 1
		}
		if (BSON.calculateObjectSize(next) > 12 * 1024 * 1024) fail('documentTooLarge', 413)
		const response = await models(db).Document.updateOne(
			{ _id: id, revision },
			{ $set: documentContent(next) },
			{ runValidators: true }
		)
		if (!response.modifiedCount) fail('documentConflict', 409)
		return { revision: next.revision }
	} finally {
		doc.destroy()
	}
}
