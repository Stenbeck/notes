<template>
	<Teleport to="body">
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3"
			@click.self="close"
		>
			<section
				ref="dialog"
				role="dialog"
				aria-modal="true"
				:aria-label="title"
				class="flex max-h-[calc(100dvh-24px)] w-full max-w-xl flex-col rounded-lg border border-(--line) bg-(--surface) shadow-xl"
				@keydown="keys"
			>
				<div class="flex shrink-0 items-center justify-between border-b border-(--line) px-5 py-3">
					<h2>{{ title }}</h2>
					<button :aria-label="t('close')" :disabled="busy" class="rounded p-1 hover:bg-(--soft)" @click="close">
						<AppIcon name="X" />
					</button>
				</div>
				<div :class="bodyClass"><slot /></div>
				<AppActions class="border-t border-(--line) px-5 py-3">
					<slot name="actions"><AppButton :disabled="busy" @click="close">
						{{ t('close') }}
					</AppButton></slot>
				</AppActions>
			</section>
		</div>
	</Teleport>
</template>
<script setup>
const props = defineProps({ title: String, busy: Boolean, bodyClass: { type: String, default: 'min-h-0 overflow-y-auto p-5' } })
const emit = defineEmits(['close'])
const close = () => { if (!props.busy) emit('close') }
const { t } = useI18n()
const dialog = ref(null)
let prior, overflow
const keys = (event) => {
	if (event.key === 'Escape') {
		event.stopPropagation()
		close()
	}
	if (event.key !== 'Tab') return
	const controls = [...dialog.value.querySelectorAll('button,input,select,textarea,a[href]')].filter(
		(el) => !el.disabled && el.getClientRects().length
	)
	if (event.shiftKey && document.activeElement === controls[0]) {
		event.preventDefault()
		controls.at(-1)?.focus()
	}
	if (!event.shiftKey && document.activeElement === controls.at(-1)) {
		event.preventDefault()
		controls[0]?.focus()
	}
}
onMounted(() => {
	prior = document.activeElement
	overflow = document.body.style.overflow
	document.body.style.overflow = 'hidden'
	dialog.value.querySelector('button')?.focus()
})
onBeforeUnmount(() => {
	document.body.style.overflow = overflow
	prior?.focus()
})
</script>
