export const attachmentId = (node) => {
	const type = typeof node.type === 'string' ? node.type : node.type?.name
	return type === 'attachment'
		? node.attrs?.id
		: type === 'image' && /^\/api\/files\/[^/?#]+$/.test(node.attrs?.src || '')
			? node.attrs.src.slice('/api/files/'.length)
			: null
}

export const referencedFiles = (json) => {
	const ids = new Set()
	const walk = (node) => {
		const id = attachmentId(node)
		if (id) ids.add(id)
		for (const child of node.content || []) walk(child)
	}
	walk(json)
	return ids
}
