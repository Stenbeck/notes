import { models } from '../models/index.js'
import { randomUUID } from 'node:crypto'
import { BSON } from 'mongodb'
import {
	emptyWorkspace,
	ancestors,
	descendants,
	effectiveShare,
	projectOf
} from '../../shared/utils/structure.js'
import { fail } from '../utils/publicError.js'

export const readWorkspace = async (db) => {
	const existing = await models(db).Workspace.findOne({ _id: 'main' }).lean()
	if (existing) return existing
	await models(db).Workspace.updateOne(
		{ _id: 'main' },
		{ $setOnInsert: emptyWorkspace() },
		{ runValidators: true, upsert: true }
	)
	return models(db).Workspace.findOne({ _id: 'main' }).lean()
}
export const mutateWorkspace = async (db, operation, actor = { type: 'owner' }) => {
	for (let attempt = 0; attempt < 8; attempt++) {
		const ws = await readWorkspace(db)
		if (ws.operations.some((item) => item.id === operation.operationId)) return ws
		if (operation.baseRevision !== undefined && operation.baseRevision !== ws.revision)
			fail('structureConflict', 409)
		const before = ws.revision
		applyOperation(ws, operation, actor)
		ws.revision++
		ws.operations = [...ws.operations.slice(-999), { id: operation.operationId, at: Date.now() }]
		if (BSON.calculateObjectSize(ws) > 8 * 1024 * 1024) fail('workspaceTooLarge', 413)
		const response = await models(db).Workspace.replaceOne({ _id: 'main', revision: before }, ws, {
			runValidators: true
		})
		if (response.modifiedCount) return ws
	}
	fail('structureConflict', 409)
}
const assertAccess = (ws, id, actor, write = true) => {
	if (actor.type === 'owner') return
	const project = projectOf(ws, id)
	if (
		!project ||
		!actor.projects.includes(project) ||
		(write && actor.permission !== 'write') ||
		(actor.type === 'mcp' && !ws.nodes[project]?.mcpEnabled) ||
		(actor.type === 'api' && !ws.nodes[project]?.apiEnabled)
	)
		fail('forbidden', 403)
}
export const applyOperation = (ws, op, actor = { type: 'owner' }) => {
	const now = new Date().toISOString()
	if (op.type === 'preferences') {
		if (actor.type !== 'owner') fail('forbidden', 403)
		ws.preferences = { ...ws.preferences, ...op.values }
		return
	}
	if (op.type === 'settings') {
		if (actor.type !== 'owner') fail('forbidden', 403)
		for (const key of ['apiEnabled', 'mcpEnabled']) if (op[key] !== undefined) ws.settings[key] = !!op[key]
		return
	}
	if (op.type === 'trash.empty') {
		if (actor.type !== 'owner') fail('forbidden', 403)
		const ids = new Set(op.ids)
		for (const id of ids) {
			if (ws.nodes[id] && ws.nodes[id].status !== 'trash') fail('structureConflict', 409)
		}
		for (const node of Object.values(ws.nodes)) {
			if (ids.has(node.parentId) && !ids.has(node.id)) fail('structureConflict', 409)
		}
		for (const id of ids) delete ws.nodes[id]
		ws.projects = ws.projects.filter((id) => !ids.has(id))
		return
	}
	if (op.type === 'project.create') {
		if (actor.type !== 'owner') fail('forbidden', 403)
		if (ws.nodes[op.id]) return
		ws.nodes[op.id] = {
			id: op.id,
			kind: 'project',
			title: op.title || 'Untitled',
			description: '',
			icon: 'Folder',
			color: '#655277',
			parentId: null,
			order: ws.projects.length,
			status: 'active',
			createdAt: now,
			updatedAt: now,
			mcpEnabled: false
		}
		ws.projects.push(op.id)
		return
	}
	if (op.type === 'document.create') {
		if (ws.nodes[op.id]) return
		if (op.parentId && (!ws.nodes[op.parentId] || ws.nodes[op.parentId].status !== 'active'))
			fail('notFound', 404)
		assertAccess(ws, op.parentId, actor)
		if (
			effectiveShare(ws, op.parentId) &&
			(!op.confirmPublic ||
				(op.shareVersion !== undefined && op.shareVersion !== effectiveShare(ws, op.parentId).version)) &&
			actor.type === 'owner'
		)
			fail('confirmPublic', 409)
		ws.nodes[op.id] = {
			id: op.id,
			title: op.title || 'Untitled',
			kind: 'document',
			parentId: op.parentId || null,
			order: Object.values(ws.nodes).filter((n) => n.parentId === (op.parentId || null)).length,
			status: 'active',
			createdAt: now,
			updatedAt: now
		}
		return
	}
	const node = ws.nodes[op.id]
	if (!node) fail('notFound', 404)
	assertAccess(ws, node.id, actor)
	if (actor.type !== 'owner' && node.kind === 'project') fail('forbidden', 403)
	if (op.type === 'node.update') {
		if (op.starred !== undefined) {
			if (actor.type !== 'owner' || node.kind !== 'document' || typeof op.starred !== 'boolean') fail('forbidden', 403)
			node.starred = op.starred
		}
		for (const key of ['title', 'description', 'icon', 'color'])
			if (typeof op[key] === 'string') node[key] = op[key].slice(0, key === 'description' ? 4000 : 250)
		for (const key of ['apiEnabled', 'mcpEnabled']) {
			if (op[key] === undefined) continue
			if (actor.type !== 'owner' || node.kind !== 'project') fail('forbidden', 403)
			node[key] = !!op[key]
		}
	} else if (op.type === 'node.move') {
		if (node.kind === 'project') {
			if (op.parentId) fail('projectNesting')
			ws.projects = ws.projects.filter((id) => id !== node.id)
			ws.projects.splice(Math.max(0, op.index || 0), 0, node.id)
			ws.projects.forEach((id, i) => {
				ws.nodes[id].order = i
			})
		} else {
			const parent = op.parentId || null
			if (parent && (!ws.nodes[parent] || ws.nodes[parent].status !== 'active')) fail('notFound', 404)
			if (parent === node.id || descendants(ws, node.id).includes(parent)) fail('cycle')
			assertAccess(ws, parent, actor)
			const oldShare = effectiveShare(ws, node.id)
			const nextShare = effectiveShare(ws, parent)
			if (actor.type !== 'owner' && oldShare?.id !== nextShare?.id) fail('publicationRequiresOwner', 403)
			if (actor.type === 'owner' && nextShare && oldShare?.id !== nextShare.id &&
				(!op.confirmPublic || op.shareVersion !== nextShare.version || op.shareId !== nextShare.id))
				fail('confirmPublic', 409)
			node.parentId = parent
			const siblings = Object.values(ws.nodes)
				.filter((n) => n.id !== node.id && n.parentId === parent && n.kind === 'document')
				.sort((a, b) => a.order - b.order)
			siblings.splice(Math.max(0, op.index ?? siblings.length), 0, node)
			siblings.forEach((n, i) => {
				n.order = i
			})
		}
	} else if (['archive', 'trash', 'restore', 'purge'].includes(op.type)) {
		if (op.type === 'restore' && effectiveShare(ws, node.parentId) && !op.confirmPublic)
			fail('confirmPublic', 409)
		if (op.type === 'purge' && actor.type !== 'owner') fail('forbidden', 403)
		const branch = [node.id, ...descendants(ws, node.id)]
		for (const id of branch) {
			const n = ws.nodes[id]
			if (op.type === 'purge') {
				if (n.status !== 'trash') fail('mustTrashFirst')
				delete ws.nodes[id]
				ws.projects = ws.projects.filter((p) => p !== id)
				continue
			}
			n.status = op.type === 'restore' ? 'active' : op.type
			delete n.share
		}
		if (op.type === 'restore' && node.parentId && ws.nodes[node.parentId]?.status !== 'active')
			node.parentId = null
	} else if (op.type === 'share') {
		if (actor.type !== 'owner') fail('forbidden', 403)
		if (
			ancestors(ws, node.id)
				.slice(0, -1)
				.some((n) => n.share)
		)
			fail('inheritedShare')
		if (op.enabled) {
			const slug = op.slug || node.share?.slug || randomUUID()
			if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(slug)) fail('invalidSlug')
			if (Object.values(ws.nodes).some((n) => n.id !== node.id && n.share?.slug === slug))
				fail('slugTaken', 409)
			if (descendants(ws, node.id).some((id) => ws.nodes[id].share) && !op.confirmReplace)
				fail('confirmReplace', 409)
			for (const id of descendants(ws, node.id)) delete ws.nodes[id].share
			node.share = {
				id: node.share?.id || randomUUID(),
				slug,
				version: (node.share?.version || 0) + 1,
				passwordHash: op.passwordHash === undefined ? node.share?.passwordHash : op.passwordHash
			}
		} else delete node.share
	} else fail('invalidOperation')
	node.updatedAt = now
}
export { assertAccess }
