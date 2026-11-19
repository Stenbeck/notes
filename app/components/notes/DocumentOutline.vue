<template>
	<aside id="document-outline" ref="panel" :aria-label="t('documentOutline')"
		class="notes-outline absolute right-0 bottom-0 z-20 flex max-w-full flex-col border-l border-(--line) bg-(--surface) shadow-lg"
		@keydown.esc.stop="emit('close')">
		<div class="flex h-12 shrink-0 items-center justify-between border-b border-(--line) px-3 font-semibold">
			<span>{{ t('documentOutline') }}</span>
			<button ref="closeButton" type="button" class="rounded p-1 hover:bg-(--soft)" :aria-label="t('close')" @click="emit('close')">
				<LucideX class="size-4" aria-hidden="true" />
			</button>
		</div>
		<nav class="min-h-0 overflow-y-auto p-2.5 text-sm" :aria-label="t('documentOutline')"
			@dragstart="start" @dragend="end" @dragover="dragOver" @dragleave="leave" @drop="drop">
			<DocumentOutlineBranch v-if="outlineTree.length" :entries="outlineTree" :draggable="!!blockDrag && editable" @jump="emit('jump', $event)" />
			<p v-else class="px-2 py-2 text-(--muted)">{{ t('documentOutlineEmpty') }}</p>
		</nav>
	</aside>
</template>

<script setup>
const props = defineProps({ headings: { type: Array, required: true }, blockDrag: Object, editable: Boolean })
let target = null
const clear = () => {
	target?.branch.removeAttribute('data-outline-drop')
	target = null
}
const start = (event) => {
	const row = event.target.closest('button[draggable="true"]')
	if (row) props.blockDrag?.start(event, Number(row.parentElement.dataset.outlineSection))
}
const end = () => {
	clear()
	props.blockDrag?.end()
}
const dragOver = (event) => {
	const drag = props.blockDrag
	if (!drag?.source.value) return
	event.preventDefault()
	event.stopPropagation()
	const branch = event.target.closest('[data-outline-section]')
	if (!branch) {
		clear()
		event.dataTransfer.dropEffect = 'none'
		return
	}
	const rect = branch.firstElementChild.getBoundingClientRect()
	const after = event.clientY > (rect.top + rect.bottom) / 2
	const from = Number(branch.dataset.outlineSection)
	const position = drag.outlinePosition(from, after)
	const allowed = drag.canDrop(position)
	if (target?.branch !== branch || target.after !== after || !allowed) clear()
	event.dataTransfer.dropEffect = allowed ? 'move' : 'none'
	if (!allowed) return
	target = { branch, position, after }
	branch.dataset.outlineDrop = after ? 'after' : 'before'
}
const leave = (event) => {
	if (!event.currentTarget.contains(event.relatedTarget)) clear()
}
const drop = (event) => {
	if (!props.blockDrag?.source.value) return
	event.preventDefault()
	event.stopPropagation()
	if (target) props.blockDrag.drop(target.position)
	end()
}
watch(() => props.blockDrag?.source.value, (source) => {
	if (!source) clear()
})
const outlineTree = computed(() => {
	const roots = []
	const ancestors = []
	for (const heading of props.headings) {
		while (ancestors.length && ancestors.at(-1).level >= heading.level) ancestors.pop()
		const entry = { ...heading, children: [] }
		const siblings = ancestors.at(-1)?.children || roots
		siblings.push(entry)
		ancestors.push(entry)
	}
	return roots
})
const emit = defineEmits(['close', 'jump'])
const { t } = useI18n()
const panel = ref(null)
const closeButton = ref(null)
const focusClose = () => closeButton.value?.focus({ preventScroll: true })
const isDocked = () => !!panel.value && getComputedStyle(panel.value).getPropertyValue('--notes-outline-docked').trim() === '1'
defineExpose({ focusClose, isDocked })
</script>
