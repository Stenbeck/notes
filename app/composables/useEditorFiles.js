import { attachmentId } from '../../shared/utils/attachments.js'

export const useEditorFiles = (editor) => {
	const { t } = useI18n()
	const { findFile, loaded, refreshFiles, removeFile } = useFiles()
	const menu = shallowRef(null), error = ref(''), deleting = ref(false)
	const mount = (view, { node, element, getPos, editor: instance }) => {
		if (!attachmentId(node)) return { update: () => {}, destroy: () => {} }
		const current = shallowRef(node)
		const button = document.createElement('button')
		button.type = 'button'
		button.className = 'notes-file-menu'
		button.textContent = '⋯'
		button.contentEditable = 'false'
		const missing = document.createElement('span')
		missing.className = 'notes-file-missing'
		missing.contentEditable = 'false'
		view.dom.classList.add('notes-file-node')
		view.dom.append(missing)
		const menuHost = node.type.name === 'image' ? element.parentElement : view.dom
		menuHost.append(button)
		const open = (event) => {
			event.preventDefault()
			event.stopPropagation()
			menu.value = { id: attachmentId(current.value), anchor: button, getPos }
		}
		button.addEventListener('click', open)
		const stop = watchEffect(() => {
			const id = attachmentId(current.value), file = findFile(id)
			const name = current.value.attrs.name || current.value.attrs.alt || file?.name || ''
			const deleted = !!file?.deleted || loaded.value && !file
			view.dom.classList.toggle('notes-file-deleted', deleted)
			button.hidden = deleted || !instance.isEditable
			button.setAttribute('aria-label', `${t('fileActions')}: ${name}`)
			button.title = t('fileActions')
			missing.textContent = `${t('fileMissing')}${name ? `: ${name}` : ''}`
			missing.hidden = !deleted
			if (current.value.type.name === 'attachment') {
				element.textContent = name
				element.setAttribute('href', `/api/files/${encodeURIComponent(id)}`)
			}
		})
		const originalStop = view.stopEvent?.bind(view)
		view.stopEvent = (event) => button.contains(event.target) || missing.contains(event.target) || originalStop?.(event) || false
		const originalIgnore = view.ignoreMutation?.bind(view)
		view.ignoreMutation = (mutation) => button.contains(mutation.target) || missing.contains(mutation.target) || mutation.type === 'attributes' && mutation.target === view.dom || (originalIgnore ? originalIgnore(mutation) : mutation.type !== 'selection')
		return {
			update: (next) => { current.value = next },
			destroy: () => {
				stop()
				button.removeEventListener('click', open)
			}
		}
	}
	const createAttachmentView = ({ node, getPos, editor: instance }) => {
		const dom = document.createElement('div')
		const link = document.createElement('a')
		dom.className = 'notes-file-attachment'
		dom.append(link)
		const view = { dom, update: () => true, ignoreMutation: () => true }
		const controls = mount(view, { node, getPos, editor: instance, element: link })
		view.update = (next) => {
			if (next.type !== node.type || attachmentId(next) !== attachmentId(node)) return false
			controls.update(next)
			return true
		}
		view.destroy = controls.destroy
		return view
	}
	const remove = async (selection) => {
		if (deleting.value) return
		deleting.value = true
		error.value = ''
		try {
			if (!await removeFile(selection.id, true)) return
			const position = selection.getPos()
			const node = typeof position === 'number' && editor.value?.state.doc.nodeAt(position)
			if (node && attachmentId(node) === selection.id)
				editor.value.chain().focus().deleteRange({ from: position, to: position + node.nodeSize }).run()
		} catch (e) { error.value = e.code || 'serverError' }
		finally { deleting.value = false }
	}
	const createMissingView = ({ node }) => {
		const current = shallowRef(node)
		const dom = document.createElement('div')
		dom.className = 'notes-file-missing notes-file-attachment'
		const stop = watchEffect(() => {
			dom.textContent = `${t('fileMissing')}${current.value.attrs.name ? `: ${current.value.attrs.name}` : ''}`
		})
		return {
			dom,
			update: (next) => {
				if (next.type !== node.type) return false
				current.value = next
				return true
			},
			ignoreMutation: () => true,
			destroy: stop
		}
	}
	let interval
	onMounted(() => {
		refreshFiles()
		interval = setInterval(refreshFiles, 5000)
	})
	onBeforeUnmount(() => clearInterval(interval))
	return { fileUI: { mount, createAttachmentView, createMissingView }, fileMenu: menu, fileError: error, removeEditorFile: remove, refreshFiles }
}
