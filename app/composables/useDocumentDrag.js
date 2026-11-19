import { yUndoPluginKey } from '@tiptap/y-tiptap'

const documentBlockEnd = (doc, position) => {
	const node = doc.nodeAt(position)
	if (!node) return null
	const end = position + node.nodeSize
	if (node.type.name !== 'heading') return end

	let offset = end
	for (let index = doc.resolve(end).index(); index < doc.childCount; index++) {
		const next = doc.child(index)
		if (next.type.name === 'heading' && next.attrs.level <= node.attrs.level) break
		offset += next.nodeSize
	}
	return offset
}

const cloneBlocks = (view, from, to) => {
	const content = document.createDocumentFragment()
	for (let position = from; position < to; position += view.state.doc.nodeAt(position).nodeSize) {
		const element = view.nodeDOM(position)
		if (element) content.append(element.cloneNode(true))
	}
	return content
}

const setDragPreview = (transfer, view, content) => {
	if (!content.hasChildNodes()) return
	const preview = document.createElement('div')
	preview.className = 'tiptap notes-block-drag-preview'
	preview.setAttribute('aria-hidden', 'true')
	preview.inert = true
	preview.style.width = `${view.dom.getBoundingClientRect().width}px`
	preview.append(content.cloneNode(true))
	document.body.append(preview)
	transfer.setDragImage(preview, 12, 12)
	requestAnimationFrame(() => preview.remove())
}

export const useDocumentDrag = (editor) => {
	const source = shallowRef(null)
	const isCurrent = () => !!source.value && editor.value?.isEditable && source.value.doc === editor.value.state.doc
	const canDrop = (position) => isCurrent() && Number.isInteger(position) &&
		(position < source.value.from || position > source.value.to)
	const outlinePosition = (position, after) => {
		if (!isCurrent() || !source.value.section) return null
		return after ? documentBlockEnd(source.value.doc, position) : position
	}
	const end = () => {
		source.value = null
	}
	const start = (event, position) => {
		const current = editor.value
		if (!current?.isEditable || !event.dataTransfer) {
			event.preventDefault()
			return
		}
		const { doc } = current.state
		const resolved = doc.resolve(position)
		const node = resolved.nodeAfter
		if (resolved.depth || resolved.textOffset || !['paragraph', 'heading'].includes(node?.type.name)) {
			event.preventDefault()
			return
		}
		event.stopPropagation()
		event.dataTransfer.setData('application/x-notes-document-block', 'move')
		event.dataTransfer.effectAllowed = 'move'
		const to = documentBlockEnd(doc, position)
		const content = cloneBlocks(current.view, position, to)
		source.value = { doc, from: position, to, section: node.type.name === 'heading' }
		setDragPreview(event.dataTransfer, current.view, content)
	}
	const drop = (position) => {
		if (!canDrop(position)) {
			end()
			return
		}
		const { from, to, doc } = source.value
		const current = editor.value
		const transaction = current.state.tr.delete(from, to)
		transaction.insert(transaction.mapping.map(position), doc.slice(from, to).content)
		const undoManager = yUndoPluginKey.getState(current.state)?.undoManager
		undoManager?.stopCapturing()
		current.view.dispatch(transaction)
		undoManager?.stopCapturing()
		end()
		current.view.focus()
	}
	return { source, canDrop, outlinePosition, start, end, drop }
}
