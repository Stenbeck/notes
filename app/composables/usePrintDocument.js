import { generateHTML } from '@tiptap/html'
import { extensions } from '../../shared/editor/schema.js'
import { attachmentId } from '../../shared/utils/attachments.js'
// Import as text so Nuxt does not inline the print stylesheet into the workspace HTML.
import printStyles from '../assets/css/print.css.txt?raw'

let activeFrame
const printError = (code) => Object.assign(new Error(code), { code })
export const usePrintDocument = () => {
	const printing = useState('notes-printing', () => false)
	const { state, getDocumentSnapshot } = useNotes()
	const { files, loaded, refreshFiles } = useFiles()
	const { t, locale } = useI18n()
	const printDocument = async (id) => {
		if (printing.value) return
		printing.value = true
		let frame
		const cleanup = () => {
			frame?.remove()
			if (activeFrame === frame) activeFrame = null
		}
		try {
			activeFrame?.remove()
			const json = await getDocumentSnapshot(id)
			if (navigator.onLine) await refreshFiles()
			const byId = new Map(files.value.map((file) => [file.id, file]))
			const markMissing = (node) => {
				const fileId = attachmentId(node)
				const file = byId.get(fileId)
				if (fileId && (file?.deleted || loaded.value && !file))
					return { type: 'missingAttachment', attrs: { name: node.attrs?.name || node.attrs?.alt || file?.name || '' } }
				return { ...node, ...(node.content ? { content: node.content.map(markMissing) } : {}) }
			}
			const title = state.value.workspace.nodes[id]?.title || t('untitled')
			const escape = (text) => String(text).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
			frame = document.createElement('iframe')
			frame.dataset.documentPrint = id
			frame.title = t('printDocument')
			frame.setAttribute('aria-hidden', 'true')
			frame.tabIndex = -1
			frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:1000px;border:0'
			const ready = new Promise((resolve, reject) => {
				const timeout = setTimeout(() => reject(printError('printImagesFailed')), 15000)
				frame.addEventListener('load', () => {
					clearTimeout(timeout)
					resolve()
				}, { once: true })
			})
			frame.srcdoc = `<!doctype html><html lang="${escape(locale.value)}"><head><meta charset="utf-8"><meta name="color-scheme" content="light"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' https: http: data: blob:; style-src 'unsafe-inline'"><title>${escape(title)}</title><style>${printStyles}</style></head><body><article><h1 class="document-title">${escape(title)}</h1>${generateHTML(markMissing(json), extensions())}</article></body></html>`
			activeFrame = frame
			document.body.append(frame)
			await ready
			const printable = frame.contentDocument
			for (const marker of printable.querySelectorAll('[data-missing-file]'))
				marker.textContent = `${t('fileMissing')}${marker.textContent ? `: ${marker.textContent}` : ''}`
			await Promise.all([...printable.images].map((image) => new Promise((resolve, reject) => {
				let timer
				const finish = (error) => {
					clearTimeout(timer)
					image.removeEventListener('load', success)
					image.removeEventListener('error', failure)
					if (error) reject(printError('printImagesFailed'))
					else resolve()
				}
				const success = () => finish(false)
				const failure = () => finish(true)
				if (image.complete) return finish(!image.naturalWidth)
				image.addEventListener('load', success, { once: true })
				image.addEventListener('error', failure, { once: true })
				timer = setTimeout(failure, 15000)
			})))
			await printable.fonts.ready
			frame.contentWindow.addEventListener('afterprint', cleanup, { once: true })
			frame.contentWindow.focus()
			frame.contentWindow.print()
		} catch (error) {
			cleanup()
			throw error
		} finally {
			printing.value = false
		}
	}
	return { printing, printDocument }
}
