export const emptyWorkspace = () => ({
	_id: 'main',
	revision: 0,
	projects: [],
	nodes: {},
	operations: [],
	settings: { apiEnabled: false, mcpEnabled: false },
	preferences: {}
})
export const ancestors = (workspace, id) => {
	const result = []
	const seen = new Set()
	while (id) {
		if (seen.has(id)) throw new Error('cycle')
		seen.add(id)
		const node = workspace.nodes[id]
		if (!node) break
		result.unshift(node)
		id = node.parentId
	}
	return result
}
export const projectOf = (workspace, id) =>
	ancestors(workspace, id).find((node) => node.kind === 'project')?.id || null
export const descendants = (workspace, id) => {
	const result = []
	const visit = (parent) =>
		Object.values(workspace.nodes)
			.filter((node) => node.parentId === parent)
			.forEach((node) => {
				result.push(node.id)
				visit(node.id)
			})
	visit(id)
	return result
}
export const childrenOf = (workspace, id = null) =>
	Object.values(workspace.nodes)
		.filter((node) => node.parentId === id && node.kind === 'document' && node.status === 'active')
		.sort((a, b) => a.order - b.order)
export const effectiveShare = (workspace, id) => {
	const chain = ancestors(workspace, id)
	if (!chain.length || chain.some((node) => node.status !== 'active')) return null
	return chain.find((node) => node.share)?.share || null
}
export const publicNode = (node) => {
	const { share, ...safe } = node
	return {
		...safe,
		shared: !!share,
		...(share
			? { share: { id: share.id, slug: share.slug, version: share.version, protected: !!share.passwordHash } }
			: {})
	}
}
export const safeWorkspace = (workspace) => ({
	...workspace,
	nodes: Object.fromEntries(Object.entries(workspace.nodes).map(([id, node]) => [id, publicNode(node)])),
	operations: undefined
})
