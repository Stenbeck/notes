import { getSchema, Node, mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Table, TableKit } from '@tiptap/extension-table'
import { TaskList, TaskItem } from '@tiptap/extension-list'

export const Attachment = Node.create({
	name: 'attachment',
	group: 'block',
	atom: true,
	addNodeView() { return this.options.fileUI?.createAttachmentView || null },
	addAttributes: () => ({ id: { default: null }, name: { default: 'File' } }),
	parseHTML: () => [{ tag: 'a[data-attachment]' }],
	renderHTML: ({ HTMLAttributes }) => [
		'a',
		mergeAttributes(
			{ 'data-attachment': '', href: `/api/files/${HTMLAttributes.id}` },
			{ 'data-id': HTMLAttributes.id }
		),
		HTMLAttributes.name
	]
})
export const MissingAttachment = Node.create({
	name: 'missingAttachment',
	group: 'block',
	atom: true,
	addNodeView() { return this.options.fileUI?.createMissingView || null },
	addAttributes: () => ({ name: { default: '' } }),
	parseHTML: () => [{ tag: 'div[data-missing-file]' }],
	renderHTML: ({ node }) => ['div', { 'data-missing-file': '', class: 'notes-file-missing' }, node.attrs.name]
})
export const NotesImage = Image.extend({
	// Tiptap's resize view commits drag sizes but does not repaint numeric attribute changes.
	addNodeView() {
		const createView = this.parent?.()
		if (!createView) return null
		return (props) => {
			const view = createView(props)
			const image = view.dom.querySelector('img')
			const wrapper = view.dom.querySelector('[data-resize-wrapper]')
			wrapper.style.width = 'fit-content'
			wrapper.style.maxWidth = '100%'
			const paint = (node) => {
				for (const dimension of ['width', 'height']) {
					const value = Number(node.attrs[dimension])
					if (Number.isFinite(value) && value > 0) {
						image.style[dimension] = dimension === 'height' ? 'auto' : `${value}px`
						image.setAttribute(dimension, String(value))
					} else {
						image.style[dimension] = 'auto'
						image.removeAttribute(dimension)
					}
				}
			}
			const controls = this.options.fileUI?.mount(view, { ...props, element: image })
			const destroy = view.destroy?.bind(view)
			view.destroy = () => {
				controls?.destroy()
				destroy?.()
			}
			const update = view.update.bind(view)
			view.update = (node, ...args) => {
				const accepted = update(node, ...args)
				if (accepted) {
					paint(node)
					controls?.update(node)
				}
				return accepted
			}
			paint(props.node)
			return view
		}
	},
	addAttributes: () => ({
		...Image.config.addAttributes(),
		align: {
			default: 'left',
			parseHTML: (element) => ['left', 'center', 'right'].includes(element.getAttribute('data-align')) ? element.getAttribute('data-align') : 'left',
			renderHTML: (attributes) => ({ 'data-align': ['left', 'center', 'right'].includes(attributes.align) ? attributes.align : 'left' })
		}
	})
})
const NotesTable = Table.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			showBorders: {
				default: true,
				parseHTML: (element) => !element.hasAttribute('data-borderless'),
				renderHTML: ({ showBorders }) => showBorders === false ? { 'data-borderless': '' } : {}
			}
		}
	}
})

export const extensions = ({ resizeImages = false, fileUI } = {}) => [
	StarterKit.configure({ undoRedo: false, link: { openOnClick: false } }),
	NotesImage.configure({ fileUI, allowBase64: false, resize: resizeImages ? { enabled: true, directions: ['bottom-left', 'bottom-right'], minWidth: 32, minHeight: 24, alwaysPreserveAspectRatio: true } : false }),
	TableKit.configure({ table: false }),
	NotesTable.configure({ resizable: true, renderWrapper: true }),
	TaskList,
	TaskItem.configure({ nested: true }),
	MissingAttachment.configure({ fileUI }),
	Attachment.configure({ fileUI })
]
let documentSchema
export const schema = () => documentSchema ||= getSchema(extensions())
