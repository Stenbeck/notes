<template>
	<div ref="root" class="relative min-w-0" @focusout="leave" @keydown="keys">
		<button
			ref="trigger"
			type="button"
			role="combobox"
			:aria-label="label"
			:aria-labelledby="labelledby"
			:aria-expanded="open"
			aria-haspopup="listbox"
			:aria-controls="listId"
			:aria-activedescendant="open ? `${listId}-${active}` : undefined"
			:disabled="disabled"
			:style="height ? { height: `${height}px` } : undefined"
			class="flex w-full items-center justify-between rounded-md text-left text-[14px] hover:bg-(--soft) disabled:opacity-50"
			:class="
				icon ? 'gap-1 p-1.5' : ['min-h-9 border border-(--line) bg-(--surface) px-3 py-2', height ? 'gap-2' : 'gap-4']
			"
			:title="icon ? label : undefined"
			@click="toggle">
			<AppIcon v-if="icon" :name="icon" :size="17" />
			<span v-else class="truncate">{{ selected?.label || placeholder }}</span>
			<LucideChevronDown class="shrink-0 text-(--muted)" :class="icon ? 'size-3' : 'size-4'" aria-hidden="true" />
		</button>
		<Teleport to="body">
			<ul
				v-if="open"
				ref="popup"
				:id="listId"
				role="listbox"
				:aria-label="label"
				:data-toolbar-options="icon ? '' : undefined"
				class="fixed z-100 overflow-auto rounded-md border border-(--line) bg-(--surface) p-1 text-(--ink) shadow-lg"
				:class="icon ? 'flex max-h-72 flex-col gap-0.5' : 'max-h-56'"
				:style="position">
				<li
					v-for="(option, index) in options"
					:id="`${listId}-${index}`"
					:key="option.value"
					role="option"
					:aria-label="iconOnlyOptions ? option.label : undefined"
					:aria-selected="option.value === model"
					class="flex min-w-0 cursor-pointer items-center rounded text-left text-[14px]"
					:class="[
						icon ? 'gap-2 px-2 py-1' : 'justify-between gap-3 px-3 py-2',
						index === active && 'bg-(--soft) text-(--accent)',
					]"
					@pointermove="active = index"
					@mousedown.prevent
					@click="choose(index)">
					<AppIcon v-if="option.icon" :name="option.icon" :size="16" />
					<span v-if="!iconOnlyOptions" class="whitespace-nowrap">{{ option.label }}</span>
					<LucideCheck v-if="option.value === model" class="ml-auto size-4 shrink-0" aria-hidden="true" />
				</li>
			</ul>
		</Teleport>
	</div>
</template>
<script setup>
const props = defineProps({
	options: { type: Array, default: () => [] },
	label: String,
	labelledby: String,
	placeholder: { type: String, default: '' },
	disabled: Boolean,
	icon: String,
	iconOnlyOptions: Boolean,
	height: Number,
})
const model = defineModel()
const emit = defineEmits(['change'])
const root = ref(null)
const trigger = ref(null)
const popup = ref(null)
const open = ref(false)
const position = ref({})
const active = ref(0)
const listId = useId()
const selected = computed(() => props.options.find((option) => option.value === model.value))
let search = ''
let searchTimer
const close = () => {
	open.value = false
}
const updatePosition = () => {
	if (!open.value || !trigger.value) return
	const rect = trigger.value.getBoundingClientRect()
	const width = popup.value?.getBoundingClientRect().width || rect.width
	const above = window.innerHeight - rect.bottom < 220 && rect.top > 220
	position.value = {
		left: `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`,
		width: 'max-content',
		minWidth: `${Math.min(rect.width, window.innerWidth - 16)}px`,
		maxWidth: `${window.innerWidth - 16}px`,
		...(above ? { bottom: `${window.innerHeight - rect.top + 4}px` } : { top: `${rect.bottom + 4}px` }),
	}
}
const toggle = () => {
	if (props.disabled || !props.options.length) return
	open.value = !open.value
	if (open.value) {
		active.value = Math.max(
			0,
			props.options.findIndex((option) => option.value === model.value)
		)
		updatePosition()
		nextTick(() => {
			updatePosition()
			document.getElementById(`${listId}-${active.value}`)?.scrollIntoView({ block: 'nearest' })
		})
	}
}
const choose = (index) => {
	if (props.disabled) return
	const option = props.options[index]
	if (!option) return
	model.value = option.value
	emit('change', option.value)
	close()
	trigger.value?.focus()
}
const keys = (event) => {
	if (props.disabled || !props.options.length) {
		close()
		return
	}
	if (event.key === 'Escape' && open.value) {
		event.preventDefault()
		event.stopPropagation()
		close()
		return
	}
	if (event.key === 'Tab') {
		close()
		return
	}
	if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
		event.preventDefault()
		if (!open.value) {
			toggle()
			return
		}
		if (event.key === 'ArrowDown') active.value = (active.value + 1) % props.options.length
		if (event.key === 'ArrowUp') active.value = (active.value + props.options.length - 1) % props.options.length
		if (event.key === 'Home') active.value = 0
		if (event.key === 'End') active.value = props.options.length - 1
		if (event.key === 'Enter' || event.key === ' ') choose(active.value)
	} else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
		clearTimeout(searchTimer)
		search += event.key.toLocaleLowerCase()
		const index = props.options.findIndex((option) => option.label.toLocaleLowerCase().startsWith(search))
		if (index >= 0) {
			if (!open.value) toggle()
			active.value = index
		}
		searchTimer = setTimeout(() => {
			search = ''
		}, 600)
	}
	nextTick(() => document.getElementById(`${listId}-${active.value}`)?.scrollIntoView({ block: 'nearest' }))
}
const leave = (event) => {
	if (!root.value?.contains(event.relatedTarget) && !popup.value?.contains(event.relatedTarget)) close()
}
const outside = (event) => {
	if (!root.value?.contains(event.target) && !popup.value?.contains(event.target)) close()
}
const scroll = (event) => {
	if (!popup.value?.contains(event.target)) updatePosition()
}
watch(
	() => props.disabled,
	(disabled) => {
		if (disabled) close()
	}
)
watch(() => props.options.map((option) => option.value).join('\u0000'), close)
onMounted(() => {
	document.addEventListener('pointerdown', outside)
	window.addEventListener('resize', updatePosition)
	window.addEventListener('scroll', scroll, true)
})
onBeforeUnmount(() => {
	document.removeEventListener('pointerdown', outside)
	window.removeEventListener('resize', updatePosition)
	window.removeEventListener('scroll', scroll, true)
	clearTimeout(searchTimer)
})
</script>
