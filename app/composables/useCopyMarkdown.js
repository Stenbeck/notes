import { generateHTML } from '@tiptap/html'
import { extensions } from '../../shared/editor/schema.js'
import { htmlToMarkdown } from '../../shared/utils/htmlToMarkdown.js'

export const useCopyMarkdown = () => {
	const { state, getDocumentSnapshot } = useNotes()
	const copying = useState('notes-copying-markdown', () => false)
	const copied = ref(false)
	let feedbackTimer
	onBeforeUnmount(() => clearTimeout(feedbackTimer))
	const copyMarkdown = async (id) => {
		if (copying.value) return
		copying.value = true
		copied.value = false
		clearTimeout(feedbackTimer)
		try {
			const text = (async () => {
				const json = await getDocumentSnapshot(id)
				const title = String(state.value.workspace.nodes[id]?.title || '').replace(/\s*\n\s*/g, ' ')
				const content = htmlToMarkdown(generateHTML(json, extensions()))
				return `${title ? `# ${title}\n\n` : ''}${content}\n`
			})()
			// Start clipboard access during the click; Safari accepts data resolved asynchronously.
			if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
				const item = new ClipboardItem({ 'text/plain': text.then((value) => new Blob([value], { type: 'text/plain' })) })
				await navigator.clipboard.write([item])
			} else {
				const value = await text
				await navigator.clipboard.writeText(value)
			}
			copied.value = true
			feedbackTimer = setTimeout(() => { copied.value = false }, 2500)
		} catch {
			throw Object.assign(new Error('copyMarkdownFailed'), { code: 'copyMarkdownFailed' })
		} finally {
			copying.value = false
		}
	}
	return { copying, copied, copyMarkdown }
}
