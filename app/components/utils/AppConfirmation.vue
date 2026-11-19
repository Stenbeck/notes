<template>
	<AppModal v-if="confirmation" :title="confirmation.title || t('confirmAction')" @close="answer(false)">
		<p class="leading-6">{{ confirmation.message }}</p>
		<template v-if="confirmation.copyURL">
			<input :aria-label="t('documentLink')" :value="confirmation.copyURL" readonly
				class="mt-3 w-full rounded border border-(--line) px-2 py-1" @focus="$event.target.select()" />
			<p v-if="copyStatus" role="status" class="mt-2 text-(--muted)">{{ t(copyStatus) }}</p>
		</template>
		<template #actions>
			<AppButton @click="answer(false)">{{ t(confirmation.copyURL ? 'close' : 'cancel') }}</AppButton>
			<AppButton v-if="confirmation.copyURL" primary @click="copyLink">{{ t('copyShareLink') }}</AppButton>
			<AppButton v-else primary :danger="confirmation.danger" @click="answer(true)">{{ confirmation.label || t('continue') }}</AppButton>
		</template>
	</AppModal>
</template>
<script setup>
const { t } = useI18n()
const { confirmation, answer } = useConfirmation()
const copyStatus = ref('')
watch(confirmation, () => { copyStatus.value = '' })
const copyLink = async () => {
	const current = confirmation.value
	let status
	try {
		await navigator.clipboard.writeText(current.copyURL)
		status = 'shareLinkCopied'
	} catch {
		status = 'copyShareLinkFailed'
	}
	if (confirmation.value === current) copyStatus.value = status
}
</script>
