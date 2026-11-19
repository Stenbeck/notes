import { readWorkspace, assertAccess } from './workspace.js'
import { childrenOf, descendants, publicNode } from '../../shared/utils/structure.js'
import { manifest, structureOperation, readDocuments, updateDocument, searchDocuments } from './operations.js'
import { fail } from '../utils/publicError.js'
const initialContent = ({ content, json }) => {
	if (content !== undefined) {
		if (typeof content !== 'string' || json !== undefined) fail('invalidInput')
		return {
			type: 'doc',
			content: content.split(/\r\n|\r|\n/).map(line => ({
				type: 'paragraph',
				...(line ? { content: [{ type: 'text', text: line }] } : {})
			}))
		}
	}
	if (json !== undefined && (json?.type !== 'doc' || !Array.isArray(json.content))) fail('invalidInput')
	return json
}

export const integrationCall = async (db, actor, action, values = {}) => {
	if (action === 'projects') {
		const response = await manifest(db, actor)
		return response.workspace.projects.map((id) => ({
			...response.workspace.nodes[id],
			children: childrenOf(response.workspace, id).map((n) => ({ id: n.id, title: n.title }))
		}))
	}
	if (action === 'search') return searchDocuments(db, values.query, actor)
	if (action === 'read') {
		const ws = await readWorkspace(db)
		const node = ws.nodes[values.id]
		if (!node) fail('notFound', 404)
		assertAccess(ws, node.id, actor, false)
		const result = {
			node: publicNode(node),
			children: childrenOf(ws, node.id).map((n) => ({ id: n.id, title: n.title, parentId: n.parentId })),
			...(node.kind === 'document' ? (await readDocuments(db, [node.id], actor, ws))[0] : {})
		}
		if (values.recursive === true || values.recursive === 'true') {
			const ids = descendants(ws, node.id).filter(
				(id) => ws.nodes[id].kind === 'document' && ws.nodes[id].status === 'active'
			)
			const offset = Math.max(0, Number(values.offset) || 0),
				limit = Math.min(100, Math.max(1, Number(values.limit) || 50))
			result.documents = await readDocuments(db, ids.slice(offset, offset + limit), actor, ws)
			result.nextOffset = offset + limit < ids.length ? offset + limit : null
		}
		return result
	}
	if (actor.permission !== 'write') fail('forbidden', 403)
	if (action === 'update')
		return updateDocument(db, values.id, { json: values.json, baseRevision: values.baseRevision }, actor)
	const types = {
		create: 'document.create',
		move: 'node.move',
		rename: 'node.update',
		archive: 'archive',
		trash: 'trash'
	}
	if (!types[action]) fail('invalidOperation')
	const operation = {
		type: types[action],
		id: values.id,
		parentId: values.parentId,
		title: values.title,
		index: values.index,
		operationId: values.operationId,
		baseRevision: values.baseRevision
	}
	return structureOperation(db, operation, actor, action === 'create' ? initialContent(values) : undefined)
}
