<template>
	<Teleport to="body">
		<section :id="id" ref="panel" tabindex="-1" :role="menu ? 'menu' : 'dialog'" :aria-label="title" :style="position"
			class="fixed z-50 flex min-h-0 flex-col rounded-lg border border-(--line) bg-(--surface) text-(--ink) shadow-xl" @keydown="keys" @focusout="leave">
			<div v-if="!menu" class="flex shrink-0 items-center justify-between gap-3 border-b border-(--line) px-4" :class="compact ? 'py-2' : 'py-3'">
				<h2>{{ title }}</h2>
				<button type="button" :aria-label="t('close')" :disabled="busy" class="rounded p-1 hover:bg-(--soft)" @click="close"><LucideX class="size-4" /></button>
			</div>
			<div ref="content" class="min-h-0 overflow-y-auto" :class="menu ? 'p-1' : compact ? 'p-3' : 'p-4'"><slot /></div>
			<AppActions v-if="$slots.actions" class="border-t border-(--line) px-4" :class="compact ? 'py-2' : 'py-3'"><slot name="actions" /></AppActions>
		</section>
	</Teleport>
</template>
<script setup>
const props = defineProps({ id: { type: String, default: 'notes-workspace-panel' }, title: String, anchor: Function, bounds: Function, width: { type: Number, default: 420 }, minWidth: { type: Number, default: 180 }, busy: Boolean, menu: Boolean, focusContent: Boolean, compact: Boolean })
const emit = defineEmits(['close'])
const { t } = useI18n()
const { confirmation } = useConfirmation()
const panel = ref(null)
const content = ref(null)
const position = ref({ visibility: 'hidden' })
let original
let restoreFocus = true
let sizeObserver
const place = () => {
	const anchor = props.anchor?.()
	const bounds = props.bounds?.() || (anchor?.isConnected ? anchor.getBoundingClientRect() : { left: innerWidth - 48, right: innerWidth - 16, top: 16, bottom: 48 })
	const minimum = Math.min(props.minWidth, innerWidth - 16)
	const width = Math.min(props.menu ? Math.max(minimum, panel.value?.getBoundingClientRect().width || minimum) : props.width, innerWidth - 16)
	const above = bounds.top > innerHeight / 2
	const room = above ? bounds.top - 14 : innerHeight - bounds.bottom - 14
	position.value = {
		left: `${Math.max(8, Math.min(bounds.left < innerWidth / 2 ? bounds.left : bounds.right - width, innerWidth - width - 8))}px`,
		width: props.menu ? 'max-content' : `${width}px`,
		minWidth: props.menu ? `${minimum}px` : undefined,
		maxWidth: `${innerWidth - 16}px`,
		maxHeight: `${Math.min(innerHeight - 16, Math.max(120, room))}px`,
		...(above ? { bottom: `${Math.max(8, innerHeight - bounds.top + 6)}px` } : { top: `${Math.max(8, bounds.bottom + 6)}px` })
	}
}
const close = (restore = true) => {
	if (props.busy || confirmation.value) return
	restoreFocus = restore !== false
	emit('close')
}
const focus = () => {
	const target = props.menu ? content.value?.querySelector('[role="menuitem"]')
		: props.focusContent ? content.value?.querySelector('input:not([type="file"]):not(:disabled),textarea:not(:disabled)') : panel.value
	const destination = target || panel.value
	destination?.focus({ preventScroll: true })
}
const outside = (event) => {
	if (confirmation.value || panel.value?.contains(event.target) || props.anchor?.()?.contains(event.target) || event.target.closest?.('[role="listbox"]')) return
	close(false)
}
const leave = (event) => {
	if (!event.relatedTarget || confirmation.value || panel.value?.contains(event.relatedTarget) || event.relatedTarget.closest?.('[role="listbox"]')) return
	close(false)
}
const keys = (event) => {
	if (event.key === 'Escape' && !confirmation.value) {
		event.preventDefault()
		event.stopPropagation()
		close()
	}
	if (!props.menu || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
	event.preventDefault()
	const items = [...content.value.querySelectorAll('[role="menuitem"]')].filter((item) => !item.disabled)
	const index = items.indexOf(document.activeElement)
	const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length
	items[next]?.focus()
}
const scroll = (event) => { if (!panel.value?.contains(event.target) && !event.target.closest?.('[role="listbox"]')) place() }
watch(() => [props.title, props.width, props.minWidth, props.menu], async () => { await nextTick()
	place()
	focus()
})
onMounted(async () => {
	original = props.anchor?.() || document.activeElement
	original?.setAttribute('aria-haspopup', props.menu ? 'menu' : 'dialog')
	original?.setAttribute('aria-expanded', 'true')
	original?.setAttribute('aria-controls', props.id)
	place()
	await nextTick()
	if (!panel.value) return
	place()
	focus()
	sizeObserver = new ResizeObserver(place)
	sizeObserver.observe(panel.value)
	document.addEventListener('pointerdown', outside)
	window.addEventListener('resize', place)
	window.addEventListener('scroll', scroll, true)
})
onBeforeUnmount(() => {
	sizeObserver?.disconnect()
	document.removeEventListener('pointerdown', outside)
	window.removeEventListener('resize', place)
	window.removeEventListener('scroll', scroll, true)
	original?.setAttribute('aria-expanded', 'false')
	if (restoreFocus && original?.isConnected && (!document.activeElement || document.activeElement === document.body || panel.value?.contains(document.activeElement))) original.focus()
})
</script>
