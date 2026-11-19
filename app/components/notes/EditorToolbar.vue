<template>
	<div class="sticky top-0 z-10 border-b border-(--line) bg-(--surface) px-4 py-1" :data-version="version" :inert="!editor.isEditable" :aria-disabled="!editor.isEditable" :class="!editor.isEditable ? 'opacity-50' : ''">
		<div ref="row" role="toolbar" :aria-label="t('format')" class="relative flex items-center gap-1" @keydown.esc="closeOverflow(true)">
			<Teleport v-for="(tool, index) in tools" :key="tool.key" defer :to="`#${overflowId}-${index}`" :disabled="index < visibleCount">
				<div :data-format-tool="index" class="shrink-0">
					<AppSelect v-if="tool.key === 'textStyle'" :model-value="textStyle" :label="t(tool.key)" :options="styles" :icon="textStyleIcon" icon-only-options @change="setStyle" />
					<AppSelect v-else-if="tool.key === 'table'" :model-value="''" :label="t(tool.key)" :options="tableOptions" :icon="tool.icon" @change="tableCommand" />
					<button v-else type="button" class="rounded p-1.5 hover:bg-(--soft)"
						:class="tool.active && editor.isActive(tool.active) ? 'bg-(--soft) text-(--accent)' : ''"
						:aria-label="t(tool.key)" :title="t(tool.key)" :aria-pressed="tool.active ? editor.isActive(tool.active) : undefined"
						@mousedown.prevent @click="runTool(tool)">
						<AppIcon :name="tool.icon" :size="17" />
					</button>
				</div>
			</Teleport>
			<button ref="overflowButton" type="button" class="shrink-0 rounded p-1.5 hover:bg-(--soft)"
				:class="{ 'invisible absolute': !hasOverflow }" :aria-label="t('moreFormattingTools')"
				:aria-expanded="overflowOpen" :aria-controls="overflowId" @mousedown.prevent @click="overflowOpen = !overflowOpen">
				<AppIcon name="Ellipsis" :size="17" />
			</button>
			<div :id="overflowId" ref="overflowPanel" role="group" :aria-label="t('moreFormattingTools')" :inert="!overflowOpen"
				class="absolute top-full right-0 mt-1 flex w-max max-w-full flex-wrap items-center gap-1 rounded-md border border-(--line) bg-(--surface) p-1 shadow-lg"
				:class="{ invisible: !overflowOpen }">
				<div v-for="(tool, index) in tools" :id="`${overflowId}-${index}`" :key="tool.key" class="contents" />
			</div>
		</div>
		<Teleport :to="overflowPanel" :disabled="!overflowPanel || !compact">
			<div v-if="imageSelected" role="toolbar" :aria-label="t('imageTools')" class="flex flex-wrap items-center gap-2 border-t border-(--line) pt-2" :class="compact ? 'w-full' : 'mt-2'">
				<button v-for="(icon, align) in alignmentIcons" :key="align" class="rounded p-1.5 hover:bg-(--soft)" :class="editor.getAttributes('image').align === align ? 'bg-(--soft) text-(--accent)' : ''" :aria-label="t(`align${align}`)" @mousedown.prevent @click="imageAttributes({ align })"><AppIcon :name="icon" /></button>
				<label class="flex items-center gap-2">{{ t('imageWidth') }}<input type="number" min="32" max="4096" :value="editor.getAttributes('image').width || ''" :placeholder="t('automatic')" class="w-24 rounded border border-(--line) bg-(--surface) px-2 py-1.5" @input="setWidth" /><span>px</span></label>
				<button v-for="percent in [25, 50, 100]" :key="percent" class="rounded border border-(--line) px-2 py-1.5 hover:bg-(--soft)" @mousedown.prevent @click="imageAttributes({ width: Math.round(editor.view.dom.clientWidth * percent / 100), height: null })">{{ percent }}%</button>
			</div>
		</Teleport>
	</div>
</template>
<script setup>
const props = defineProps({ editor: Object, version: Number })
const emit = defineEmits(['attachment', 'link'])
const { t } = useI18n()
const imageSelected = computed(() => {
	props.version
	return props.editor.isActive('image')
})
const textStyle = computed(() => {
	props.version
	return props.editor.isActive('heading') ? String(props.editor.getAttributes('heading').level) : 'paragraph'
})
const styles = computed(() => [
	{ value: 'paragraph', label: t('paragraph'), icon: 'Type' },
	...[1, 2, 3, 4, 5, 6].map((level) => ({ value: String(level), label: t(`heading${level}`), icon: `Heading${level}` }))
])
const textStyleIcon = computed(() => styles.value.find((style) => style.value === textStyle.value)?.icon || 'Type')
const editorChain = () => props.editor.chain().focus(undefined, { scrollIntoView: false })
const setStyle = (value) => {
	closeOverflow()
	const chain = editorChain()
	if (value === 'paragraph') chain.setParagraph().run()
	else chain.setHeading({ level: Number(value) }).run()
}
const commands = [
	{ key: 'bold', icon: 'Bold', active: 'bold', run: (chain) => chain.toggleBold() },
	{ key: 'italic', icon: 'Italic', active: 'italic', run: (chain) => chain.toggleItalic() },
	{ key: 'underline', icon: 'Underline', active: 'underline', run: (chain) => chain.toggleUnderline() },
	{ key: 'strike', icon: 'Strikethrough', active: 'strike', run: (chain) => chain.toggleStrike() },
	{ key: 'inlineCode', icon: 'CodeXml', active: 'code', run: (chain) => chain.toggleCode() },
	{ key: 'bulletList', icon: 'List', active: 'bulletList', run: (chain) => chain.toggleBulletList() },
	{ key: 'orderedList', icon: 'ListOrdered', active: 'orderedList', run: (chain) => chain.toggleOrderedList() },
	{ key: 'taskList', icon: 'ListChecks', active: 'taskList', run: (chain) => chain.toggleTaskList() },
	{ key: 'blockquote', icon: 'Quote', active: 'blockquote', run: (chain) => chain.toggleBlockquote() },
	{ key: 'codeBlock', icon: 'Code', active: 'codeBlock', run: (chain) => chain.toggleCodeBlock() },
	{ key: 'horizontalRule', icon: 'Minus', run: (chain) => chain.setHorizontalRule() },
	{ key: 'undo', icon: 'Undo2', run: (chain) => chain.undo() },
	{ key: 'redo', icon: 'Redo2', run: (chain) => chain.redo() }
]
const tools = [
	{ key: 'textStyle' },
	...commands,
	{ key: 'table', icon: 'Table' },
	{ key: 'link', icon: 'Link' },
	{ key: 'attachment', icon: 'Paperclip' }
]
const runTool = (tool) => {
	closeOverflow()
	if (tool.run) tool.run(editorChain()).run()
	else emit(tool.key)
}
const row = ref(null)
const overflowButton = ref(null)
const overflowPanel = ref(null)
const overflowId = useId()
const visibleCount = ref(tools.length)
const overflowOpen = ref(false)
const compact = ref(false)
const hasOverflow = computed(() => visibleCount.value < tools.length || (compact.value && imageSelected.value))
let observer, compactMedia
const closeOverflow = (restoreFocus = false) => {
	if (!overflowOpen.value) return
	overflowOpen.value = false
	if (restoreFocus) overflowButton.value?.focus()
}
const fitTools = () => {
	const available = row.value.clientWidth
	const gap = parseFloat(getComputedStyle(row.value).columnGap) || 0
	const widths = Array.from(row.value.querySelectorAll('[data-format-tool]')).reduce((ordered, element) => {
		ordered[Number(element.dataset.formatTool)] = element.getBoundingClientRect().width
		return ordered
	}, [])
	const total = widths.reduce((sum, width) => sum + width, 0) + gap * (widths.length - 1)
	if (total <= available && !(compact.value && imageSelected.value)) {
		visibleCount.value = tools.length
		return
	}
	let used = overflowButton.value.getBoundingClientRect().width
	visibleCount.value = widths.findIndex((width) => {
		used += width + gap
		return used > available
	})
	if (visibleCount.value === -1) visibleCount.value = tools.length
}
const updateCompact = () => {
	compact.value = compactMedia.matches
	fitTools()
}
const closeFromOutside = (event) => {
	if (!overflowOpen.value || row.value.contains(event.target)) return
	const listId = overflowPanel.value.querySelector('[aria-expanded="true"][aria-controls]')?.getAttribute('aria-controls')
	if (!listId || !document.getElementById(listId)?.contains(event.target)) closeOverflow()
}
watch(hasOverflow, (visible) => { if (!visible) closeOverflow() })
watch(imageSelected, fitTools, { flush: 'post' })
onMounted(() => {
	compactMedia = window.matchMedia('(max-width: 767px), (pointer: coarse)')
	compactMedia.addEventListener('change', updateCompact)
	updateCompact()
	observer = new ResizeObserver(fitTools)
	observer.observe(row.value)
	document.addEventListener('pointerdown', closeFromOutside)
})
onBeforeUnmount(() => {
	observer?.disconnect()
	compactMedia?.removeEventListener('change', updateCompact)
	document.removeEventListener('pointerdown', closeFromOutside)
})
const alignmentIcons = { left: 'AlignLeft', center: 'AlignCenter', right: 'AlignRight' }
const tableActions = {
	addColumnBefore: 'Columns3',
	addColumnAfter: 'Columns3',
	deleteColumn: 'Columns3',
	addRowBefore: 'Rows3',
	addRowAfter: 'Rows3',
	deleteRow: 'Rows3',
	toggleHeaderRow: 'Rows3',
	toggleHeaderColumn: 'Columns3',
	mergeCells: 'Table',
	splitCell: 'Table',
	deleteTable: 'Trash2'
}
const tableBordersHidden = () => props.editor.getAttributes('table').showBorders === false
const tableOptions = computed(() => {
	props.version
	if (!props.editor.isActive('table')) return [{ value: 'insertTable', label: t('insertTable'), icon: 'Table' }]
	const can = props.editor.can()
	return [
		...Object.entries(tableActions).filter(([action]) => can[action]()).map(([value, icon]) => ({ value, label: t(value), icon })),
		...Object.entries(alignmentIcons).map(([value, icon]) => ({ value, label: t(`align${value}`), icon })),
		{ value: 'toggleTableBorders', icon: 'Table', label: t(tableBordersHidden() ? 'showTableBorders' : 'hideTableBorders') }
	]
})
const tableCommand = (command) => {
	closeOverflow()
	if (command === 'insertTable') editorChain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
	else if (Object.hasOwn(alignmentIcons, command)) editorChain().setCellAttribute('align', command).run()
	else if (command === 'toggleTableBorders') editorChain().updateAttributes('table', { showBorders: tableBordersHidden() }).run()
	else if (Object.hasOwn(tableActions, command)) editorChain()[command]().run()
}
const imageAttributes = (attributes) => props.editor.chain().focus().updateAttributes('image', attributes).run()
const setWidth = (event) => {
	const input = event.currentTarget
	if (input.validity.badInput) return
	const width = input.valueAsNumber
	if (input.value && (width < 32 || width > 4096 || !Number.isFinite(width))) return
	props.editor.commands.updateAttributes('image', { width: input.value ? Math.round(width) : null, height: null })
}
</script>
