<template>
	<form class="space-y-3 rounded-md border border-(--line) bg-(--paper) p-4" @submit.prevent="emit('save', canvas.toDataURL('image/webp', 0.85))">
		<canvas ref="canvas" width="512" height="512" tabindex="0" role="img" :aria-label="t('cropHelp')" class="mx-auto aspect-square w-full max-w-64 touch-none rounded-full border border-(--line)" @pointerdown="startDrag" @pointermove="drag" @pointerup="stopDrag" @pointercancel="stopDrag" @keydown="moveWithKeys" />
		<p class="text-[14px] leading-5 text-(--muted)">{{ t('cropHelp') }}</p>
		<label class="block">{{ t('zoom') }}<input v-model.number="zoom" type="range" min="1" max="3" step="0.01" :aria-label="t('zoom')" :disabled="busy" class="mt-2 w-full" /></label>
		<div class="grid gap-2 sm:flex sm:justify-end"><SettingsButton :disabled="busy" @click="emit('cancel')">{{ t('cancel') }}</SettingsButton><SettingsButton type="submit" primary :disabled="busy || !source">{{ t('saveImage') }}</SettingsButton></div>
	</form>
</template>
<script setup>
const { t } = useI18n()
const props = defineProps({ source: { type: Object, default: null }, name: { type: String, required: true }, busy: Boolean, disabled: Boolean, error: { type: String, default: '' } })
const emit = defineEmits(['save', 'cancel'])
const canvas = ref(null)
const zoom = ref(1)
const x = ref(0)
const y = ref(0)
let pointer
const draw = () => {
	if (!props.source || !canvas.value) return
	const image = props.source
	const scale = Math.max(512 / image.width, 512 / image.height) * zoom.value
	const width = image.width * scale
	const height = image.height * scale
	x.value = Math.max(-(width - 512) / 2, Math.min((width - 512) / 2, x.value))
	y.value = Math.max(-(height - 512) / 2, Math.min((height - 512) / 2, y.value))
	const context = canvas.value.getContext('2d')
	context.clearRect(0, 0, 512, 512)
	context.drawImage(image, (512 - width) / 2 + x.value, (512 - height) / 2 + y.value, width, height)
}
const startDrag = event => {
	if (props.busy) return
	canvas.value.setPointerCapture(event.pointerId)
	pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
}
const drag = event => {
	if (!pointer || pointer.id !== event.pointerId || props.busy) return
	const ratio = 512 / canvas.value.getBoundingClientRect().width
	x.value += (event.clientX - pointer.x) * ratio
	y.value += (event.clientY - pointer.y) * ratio
	pointer.x = event.clientX
	pointer.y = event.clientY
	draw()
}
const stopDrag = () => { pointer = null }
const moveWithKeys = event => {
	if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || props.busy) return
	event.preventDefault()
	if (event.key === 'ArrowLeft') x.value -= 10
	if (event.key === 'ArrowRight') x.value += 10
	if (event.key === 'ArrowUp') y.value -= 10
	if (event.key === 'ArrowDown') y.value += 10
	draw()
}
watch(zoom, draw)
onMounted(draw)
</script>
