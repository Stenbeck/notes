import { descendants } from './structure.js'
export const applyLocalOperation = (ws, op) => {
	const now = new Date().toISOString()
	if (op.type === 'document.create' || op.type === 'project.create') {
		const project = op.type === 'project.create'
		ws.nodes[op.id] ||= {
			id: op.id,
			title: op.title,
			kind: project ? 'project' : 'document',
			parentId: op.parentId || null,
			order: Object.values(ws.nodes).filter((n) => n.parentId === (op.parentId || null)).length,
			status: 'active',
			createdAt: now,
			updatedAt: now
		}
		if (project && !ws.projects.includes(op.id)) ws.projects.push(op.id)
	}
	if (op.type === 'node.update' && ws.nodes[op.id])
		Object.assign(
			ws.nodes[op.id],
			Object.fromEntries(
				['title', 'description', 'icon', 'color', 'mcpEnabled', 'apiEnabled', 'starred']
					.filter((k) => op[k] !== undefined)
					.map((k) => [k, op[k]])
			)
		)
	if (op.type === 'node.move' && ws.nodes[op.id]) {
		const node = ws.nodes[op.id]
		if (node.kind === 'project') {
			ws.projects = ws.projects.filter((id) => id !== node.id)
			ws.projects.splice(op.index || 0, 0, node.id)
			ws.projects.forEach((id, i) => {
				ws.nodes[id].order = i
			})
		} else {
			node.parentId = op.parentId || null
			const siblings = Object.values(ws.nodes)
				.filter((n) => n.id !== node.id && n.parentId === node.parentId && n.kind === 'document')
				.sort((a, b) => a.order - b.order)
			siblings.splice(op.index ?? siblings.length, 0, node)
			siblings.forEach((n, i) => {
				n.order = i
			})
		}
	}
	if (op.type === 'trash.empty') {
		const ids = new Set(op.ids)
		for (const id of ids) delete ws.nodes[id]
		ws.projects = ws.projects.filter((id) => !ids.has(id))
	}
	if (['archive', 'trash', 'restore', 'purge'].includes(op.type)) {
		for (const id of [op.id, ...descendants(ws, op.id)]) {
			if (!ws.nodes[id]) continue
			if (op.type === 'purge') {
				delete ws.nodes[id]
				ws.projects = ws.projects.filter((p) => p !== id)
			} else {
				ws.nodes[id].status = op.type === 'restore' ? 'active' : op.type
				delete ws.nodes[id].share
				delete ws.nodes[id].shared
			}
		}
		if (
			op.type === 'restore' &&
			ws.nodes[op.id]?.parentId &&
			ws.nodes[ws.nodes[op.id].parentId]?.status !== 'active'
		)
			ws.nodes[op.id].parentId = null
	}
	if (op.type === 'settings') {
		for (const key of ['apiEnabled', 'mcpEnabled']) if (op[key] !== undefined) ws.settings[key] = !!op[key]
	}
	if (op.type === 'preferences') ws.preferences = { ...ws.preferences, ...op.values }
}

