<template>
	<Teleport to="body">
		<div v-if="range && items.length" ref="menu" role="menu" :aria-label="t('insertBlock')" :style="position"
			class="fixed z-50 flex flex-col overflow-y-auto overscroll-contain rounded-md border border-(--line) bg-(--surface) p-1 text-(--ink) shadow-lg">
			<button v-for="(command, index) in items" :key="command.key" role="menuitem" type="button"
				class="flex shrink-0 items-center gap-2 whitespace-nowrap rounded px-3 py-1.5 text-left hover:bg-(--soft)"
				:class="{ 'bg-(--soft)': index === active }" @mousedown.prevent @pointermove="active = index" @click="choose(command)">
				<AppIcon :name="command.icon" />{{ t(command.key) }}
			</button>
		</div>
	</Teleport>
</template>
<script setup>
const props = defineProps({ editor: Object, commands: Array })
const emit = defineEmits(['image'])
const { t } = useI18n()
const menu = ref(null)
const range = shallowRef(null)
const query = ref('')
const active = ref(0)
const position = ref({ visibility: 'hidden' })
let dismissed = null
const items = computed(() => [...props.commands, { key: 'image', icon: 'Image' }].filter(command => t(command.key).toLocaleLowerCase().includes(query.value.toLocaleLowerCase())))
const place = () => {
	if (!range.value || !menu.value || props.editor.isDestroyed) return
	const caret = props.editor.view.coordsAtPos(props.editor.state.selection.from)
	const viewport = window.visualViewport
	const left = viewport?.offsetLeft || 0
	const top = viewport?.offsetTop || 0
	const width = viewport?.width || innerWidth
	const height = viewport?.height || innerHeight
	if (caret.bottom < top || caret.top > top + height) {
		position.value = { display: 'none' }
		return
	}
	if (position.value.display === 'none') {
		position.value = { visibility: 'hidden' }
		nextTick(place)
		return
	}
	const below = top + height - caret.bottom - 8
	const above = caret.top - top - 8
	const upward = below < Math.min(300, menu.value.scrollHeight) && above > below
	const room = Math.max(0, Math.min(300, menu.value.scrollHeight + 2, upward ? above : below))
	const menuWidth = Math.min(260, width - 16)
	position.value = {
		width: `${menuWidth}px`, maxHeight: `${room}px`,
		left: `${Math.max(left + 8, Math.min(caret.left, left + width - menuWidth - 8))}px`,
		...(upward ? { top: `${caret.top - room - 6}px` } : { top: `${caret.bottom + 6}px` })
	}
}
const close = () => {
	dismissed = range.value?.from ?? null
	range.value = null
}
const update = () => {
	const { selection } = props.editor.state
	if (!props.editor.isEditable || !selection.empty || !selection.$from.parent.isTextblock) {
		close()
		return
	}
	const text = selection.$from.parent.textBetween(0, selection.$from.parentOffset, '\n', '\ufffc')
	const match = /(?:^|\s)\/([^\s/]*)$/.exec(text)
	if (!match) {
		range.value = null
		dismissed = null
		return
	}
	const from = selection.from - match[1].length - 1
	if (dismissed === from) return
	if (query.value !== match[1] || range.value?.from !== from) active.value = 0
	query.value = match[1]
	range.value = { from, to: selection.from }
	nextTick(place)
}
const choose = (command) => {
	if (!range.value || !command) return
	const selection = { ...range.value }
	close()
	const chain = props.editor.chain().focus().deleteRange(selection)
	if (command.key === 'image') {
		chain.run()
		emit('image')
	} else command.run(chain).run()
}
const handleKeyDown = (event) => {
	if (!range.value || !items.value.length || event.isComposing) return false
	if (event.key === 'Escape' || event.key === 'Tab') {
		close()
		return event.key === 'Escape'
	}
	if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return false
	if (event.key === 'Enter') choose(items.value[active.value])
	else {
		active.value = (active.value + (event.key === 'ArrowUp' ? -1 : 1) + items.value.length) % items.value.length
		nextTick(() => menu.value?.children[active.value]?.scrollIntoView({ block: 'nearest' }))
	}
	return true
}
const outside = (event) => {
	if (!menu.value?.contains(event.target) && !props.editor.view.dom.contains(event.target)) close()
}
onMounted(() => {
	props.editor.on('transaction', update)
	document.addEventListener('pointerdown', outside)
	window.addEventListener('scroll', place, true)
	window.addEventListener('resize', place)
	window.visualViewport?.addEventListener('resize', place)
	window.visualViewport?.addEventListener('scroll', place)
})
onBeforeUnmount(() => {
	props.editor.off('transaction', update)
	document.removeEventListener('pointerdown', outside)
	window.removeEventListener('scroll', place, true)
	window.removeEventListener('resize', place)
	window.visualViewport?.removeEventListener('resize', place)
	window.visualViewport?.removeEventListener('scroll', place)
})
defineExpose({ handleKeyDown })
</script>
