<template>
	<div>
		<EditorToolbar v-if="editor" ref="toolbar" :editor="editor" :version="version" @attachment="fileInput.click()" @link="openLink" />
		<input
			ref="fileInput"
			type="file"
			class="sr-only"
			:aria-label="t('attachment')"
			:disabled="uploading"
			@change="fileSelected" />
		<div class="notes-outline-content">
			<article class="mx-auto w-full max-w-4xl px-5 pt-10 pb-5 sm:px-7 sm:pt-12">
				<div class="mb-3 flex items-center gap-4">
					<input
						v-model="title"
						:disabled="state.workspace.nodes[id]?.status !== 'active'"
						:aria-label="t('title')"
						class="min-w-0 flex-1 border-0 bg-transparent px-0 text-[24px] leading-tight font-semibold tracking-tight outline-none! shadow-none!"
						@input="rename"
						@blur="flushTitle"
						@keydown.enter.prevent="editor?.commands.focus('start')" />
					<button
						:aria-label="t(state.workspace.nodes[id]?.starred ? 'unstar' : 'star')"
						:aria-pressed="!!state.workspace.nodes[id]?.starred"
						class="shrink-0 rounded p-1 text-(--star) hover:bg-(--soft)"
						@click="operation({ type: 'node.update', id, starred: !state.workspace.nodes[id]?.starred })">
						<LucideStar class="size-5" :fill="state.workspace.nodes[id]?.starred ? 'currentColor' : 'none'" />
					</button>
					<span
						v-if="effectiveShare(state.workspace, id)"
						class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-(--accent) bg-(--soft) px-3 py-1 font-medium text-(--accent)">
						<LucideGlobe class="size-4" />
						{{ t('shared') }}
					</span>
				</div>
				<div v-if="editor" ref="body" class="relative" @pointermove="showBlockHandle"
					@pointerleave="hideBlockHandle" @dragover.capture="dragOverBlocks" @dragleave="leaveBlocks" @drop.capture="dropOnBlocks">
					<EditorContent :editor="editor" />
					<div v-if="blockTarget && blockDrag.source.value" aria-hidden="true"
						class="notes-block-drop-marker pointer-events-none absolute inset-x-0 h-0.5 -translate-y-1/2 rounded-full bg-(--accent)"
						:style="{ top: `${blockTarget.top}px` }" />
					<span v-if="blockHandle" class="absolute end-full grid size-5 -translate-y-1/2 cursor-grab place-items-center rounded text-(--muted) hover:bg-(--soft)"
						:style="{ top: `${blockHandle.top}px` }" :title="t('moveDocumentBlock')" draggable="true"
						@dragstart="blockDrag.start($event, blockHandle.position)" @dragend="endBlockDrag">
						<LucideGripVertical class="pointer-events-none size-4" aria-hidden="true" />
					</span>
				</div>

				<p v-if="fileError" role="alert" class="error-message mt-3">{{ t(fileError) }}</p>
				<p v-if="state.pendingUploads" class="mt-3 text-[14px] text-(--muted)">{{ t('uploadPending') }}</p>
				<section v-if="children.length" class="mt-6 border-t border-(--line) pt-4">
					<h2 class="mb-2">{{ t('children') }}</h2>
					<DocumentList :nodes="children" />
				</section>
			</article>
		</div>
		<FileActions
			v-if="fileMenu"
			:id="fileMenu.id"
			:anchor="() => fileMenu?.anchor"
			@close="fileMenu = null"
			@remove="removeEditorFile(fileMenu)" />
		<EditorSlashMenu
			v-if="editor"
			ref="slashMenu"
			:editor="editor"
			:commands="blockCommands"
			@image="fileInput.click()" />
		<AppModal v-if="linkOpen" :title="t('link')" @close="linkOpen = false">
			<form id="editor-link" @submit.prevent="saveLink">
				<label class="block">
					{{ t('linkAddress') }}
					<input
						v-model="linkValue"
						autofocus
						class="mt-2 w-full rounded-md border border-(--line) bg-(--surface) px-3 py-2"
						placeholder="https://" />
				</label>
				<p v-if="linkError" role="alert" class="error-message mt-2">{{ t('invalidLink') }}</p>
			</form>
			<template #actions>
				<AppButton @click="linkOpen = false">{{ t('cancel') }}</AppButton>
				<AppButton form="editor-link" type="submit" primary>{{ t('save') }}</AppButton>
			</template>
		</AppModal>
	</div>
</template>
<script setup>
import { Editor, EditorContent } from '@tiptap/vue-3'
import Collaboration from '@tiptap/extension-collaboration'
import { extensions } from '../../../shared/editor/schema.js'
const props = defineProps({ id: String })
const { t } = useI18n()
const { state, openDocument, operation, upload, childrenOf, effectiveShare } = useNotes()
const editor = shallowRef(null),
	slashMenu = ref(null),
	title = ref('')
const children = computed(() => childrenOf(state.value.workspace, props.id))
const { fileUI, fileMenu, fileError, removeEditorFile, refreshFiles } = useEditorFiles(editor)
const version = ref(0)
const fileInput = ref(null)
const uploading = ref(false)
const linkOpen = ref(false)
const linkValue = ref('')
const linkError = ref(false)
const blockCommands = [
	{ key: 'paragraph', icon: 'Type', run: (chain) => chain.setParagraph() },
	...[1, 2, 3, 4, 5, 6].map((level) => ({
		key: `heading${level}`,
		icon: level === 1 ? 'Heading1' : level === 2 ? 'Heading2' : 'Heading3',
		run: (chain) => chain.setHeading({ level }),
	})),
	{ key: 'bulletList', icon: 'List', run: (chain) => chain.toggleBulletList() },
	{ key: 'orderedList', icon: 'ListOrdered', run: (chain) => chain.toggleOrderedList() },
	{ key: 'taskList', icon: 'ListChecks', run: (chain) => chain.toggleTaskList() },
	{ key: 'blockquote', icon: 'Quote', run: (chain) => chain.toggleBlockquote() },
	{ key: 'codeBlock', icon: 'Code', run: (chain) => chain.toggleCodeBlock() },
	{ key: 'table', icon: 'Table', run: (chain) => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }) },
	{ key: 'horizontalRule', icon: 'Minus', run: (chain) => chain.setHorizontalRule() },
]
let renameTimer
let pendingTitle
const flushTitle = () => {
	clearTimeout(renameTimer)
	if (!pendingTitle) return
	const change = pendingTitle
	pendingTitle = null
	operation(change)
}
const rename = () => {
	pendingTitle = { type: 'node.update', id: props.id, title: title.value }
	clearTimeout(renameTimer)
	renameTimer = setTimeout(flushTitle, 500)
}
const openLink = () => {
	linkValue.value = editor.value.getAttributes('link').href || ''
	linkError.value = false
	linkOpen.value = true
}
const saveLink = () => {
	const href = linkValue.value.trim()
	if (href && !/^(https?:\/\/|mailto:|\/(?:doc|d)\/)/.test(href)) {
		linkError.value = true
		return
	}
	if (href) editor.value.chain().focus().extendMarkRange('link').setLink({ href }).run()
	else editor.value.chain().focus().unsetLink().run()
	linkOpen.value = false
}
const fileSelected = async (event) => {
	const file = event.target.files?.[0]
	event.target.value = ''
	if (!file || uploading.value) return
	uploading.value = true
	try {
		await upload(file)
		await refreshFiles()
	} finally {
		uploading.value = false
	}
}
const paragraphTabHandlers = () => {
	let leaveOnTab = false
	return {
		blur: () => {
			leaveOnTab = false
			return false
		},
		keydown: (view, event) => {
			const leave = leaveOnTab
			leaveOnTab = false
			if (slashMenu.value?.handleKeyDown(event)) {
				event.preventDefault()
				return true
			}
			const { key, isComposing, shiftKey, altKey, ctrlKey, metaKey } = event
			if (key !== 'Tab' && key !== 'Escape') return false
			if (!view.editable || isComposing || shiftKey || altKey || ctrlKey || metaKey) return false
			const { $from, $to } = view.state.selection
			if ($from.depth !== 1 || $from.parent.type.name !== 'paragraph' || !$from.sameParent($to)) return false
			if (key === 'Escape') {
				leaveOnTab = true
				return false
			}
			// Let the browser move focus when Escape preceded Tab.
			if (leave) return true
			event.preventDefault()
			view.dispatch(view.state.tr.insertText('\t'))
			return true
		},
	}
}
const body = ref(null)
const blockHandle = shallowRef(null)
const blockDrag = useDocumentDrag(editor)
const blockTarget = shallowRef(null)

const showBlockHandle = (event) => {
	if (event.buttons || event.pointerType === 'touch' || !editor.value.isEditable || blockDrag.source.value) return
	const { view, state: { doc } } = editor.value
	if (!view.dom.contains(event.target)) return
	const hit = view.posAtCoords({ left: event.clientX, top: event.clientY })
	if (!hit) return
	const resolved = doc.resolve(hit.pos)
	const position = resolved.depth ? resolved.before(1) : hit.pos
	if (blockHandle.value?.position === position) return
	const node = doc.nodeAt(position)
	const element = view.nodeDOM(position)
	if (!element || !['paragraph', 'heading'].includes(node?.type.name)) {
		blockHandle.value = null
		return
	}
	const lineHeight = parseFloat(getComputedStyle(element).lineHeight)
	blockHandle.value = {
		position,
		top: element.getBoundingClientRect().top - body.value.getBoundingClientRect().top + lineHeight / 2,
	}
}

const hideBlockHandle = () => {
	if (!blockDrag.source.value) blockHandle.value = null
}
const endBlockDrag = () => {
	blockTarget.value = null
	blockDrag.end()
	hideBlockHandle()
}

const dragOverBlocks = (event) => {
	if (!blockDrag.source.value) return
	event.preventDefault()
	event.stopPropagation()
	const { view, state: { doc } } = editor.value
	const hit = view.posAtCoords({ left: event.clientX, top: event.clientY })
	let position = null
	if (hit) {
		const resolved = doc.resolve(hit.pos)
		position = hit.pos
		if (resolved.depth) {
			const rect = view.nodeDOM(resolved.before(1))?.getBoundingClientRect()
			position = rect && event.clientY > (rect.top + rect.bottom) / 2 ? resolved.after(1) : resolved.before(1)
		}
	}
	blockTarget.value = null
	event.dataTransfer.dropEffect = 'none'
	if (!blockDrag.canDrop(position)) return

	const previous = doc.resolve(position).nodeBefore
	const before = previous && view.nodeDOM(position - previous.nodeSize)?.getBoundingClientRect()
	const after = view.nodeDOM(position)?.getBoundingClientRect()
	const edge = before && after ? (before.bottom + after.top) / 2 : before?.bottom ?? after?.top
	if (edge === undefined) return
	blockTarget.value = { position, top: edge - body.value.getBoundingClientRect().top }
	event.dataTransfer.dropEffect = 'move'
}

const leaveBlocks = (event) => {
	if (!body.value?.contains(event.relatedTarget)) blockTarget.value = null
}

const dropOnBlocks = (event) => {
	if (!blockDrag.source.value) return
	event.preventDefault()
	event.stopPropagation()
	blockDrag.drop(blockTarget.value?.position)
	blockTarget.value = null
}

const toolbar = ref(null)
const toolbarElement = computed(() => toolbar.value?.$el)
const headingDocument = shallowRef(null)
const headings = computed(() => {
	const entries = []
	headingDocument.value?.forEach((node, position) => {
		if (node.type.name !== 'heading') return
		const title = node.textContent.trim()
		if (title) entries.push({ position, level: node.attrs.level, title })
	})
	return entries
})
const scrollToHeading = (position, scroller) => {
	if (!scroller) return
	const heading = editor.value?.view.nodeDOM(position)
	if (!heading) return
	const toolbarHeight = toolbarElement.value?.offsetHeight || 0
	scroller.scrollTop += heading.getBoundingClientRect().top - scroller.getBoundingClientRect().top - toolbarHeight
}
defineExpose({ headings, scrollToHeading, toolbarElement, blockDrag })
const load = async () => {
	editor.value?.destroy()
	title.value = state.value.workspace.nodes[props.id]?.title || ''
	const doc = await openDocument(props.id)
	editor.value = new Editor({
		editable: state.value.workspace.nodes[props.id]?.status === 'active',
		extensions: [...extensions({ resizeImages: true, fileUI }), Collaboration.configure({ document: doc })],
		onTransaction: ({ transaction }) => {
			if (transaction.docChanged) {
				headingDocument.value = transaction.doc
				blockTarget.value = null
				hideBlockHandle()
			}
			version.value++
		},
		editorProps: {
			attributes: { spellcheck: 'true' },
			handleDOMEvents: paragraphTabHandlers(),
			handleClick: (view, position, event) => {
				const anchor = event.target.closest('a')
				if (anchor && (event.metaKey || event.ctrlKey)) {
					const href = anchor.getAttribute('href')
					if (href?.startsWith('/doc/') || href?.startsWith('/d/')) navigateTo(href)
					else if (/^https?:\/\//.test(href || '')) window.open(href, '_blank', 'noopener')
					return true
				}
				return false
			},
		},
	})
	headingDocument.value = editor.value.state.doc
}
watch(() => props.id, load)
watch(
	() => state.value.workspace.nodes[props.id]?.status,
	(status) => editor.value?.setEditable(status === 'active')
)
onMounted(() => {
	load()
})
onBeforeUnmount(() => {
	flushTitle()
	editor.value?.destroy()
})
</script>
