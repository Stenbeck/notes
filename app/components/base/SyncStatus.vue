<template>
	<button ref="trigger" type="button" data-sync-status :data-state="status" :data-severity="presentation.severity" :aria-label="`${t('syncStatus')}: ${message}`" :title="message"
		class="shrink-0 rounded p-1 hover:bg-(--soft) inset-ring-[0.5px] inset-ring-transparent hover:inset-ring-(--paper-hover-border)" :class="color" aria-haspopup="dialog" :aria-expanded="open" aria-controls="notes-sync-panel" @click="open = !open">
		<AppIcon :name="icon" :class="{ 'animate-spin': status === 'syncing' || status === 'loading' }" />
		<span class="sr-only" role="status" aria-live="polite">{{ message }}</span>
	</button>
	<AppPopover v-if="open" id="notes-sync-panel" :title="t('syncStatus')" :anchor="() => trigger" :width="300" compact @close="open = false">
		<p :class="color">{{ message }}</p>
		<p class="mt-2 text-(--muted)">{{ t(presentation.detail) }}</p>
		<template #actions>
			<template v-if="presentation.action === 'resolve'">
				<AppButton @click="resolveQueue(true)">{{ t('discardChanges') }}</AppButton>
				<AppButton primary @click="resolveQueue(false)">{{ t('retryChanges') }}</AppButton>
			</template>
			<AppButton v-else-if="presentation.action === 'login'" :tag="NuxtLink" to="/login" primary>{{ t('login') }}</AppButton>
			<AppButton v-else :disabled="!online || ['syncing', 'loading'].includes(status)" :primary="presentation.action !== 'retry'" @click="retry">{{ t(presentation.action === 'retry' ? 'syncRetry' : 'syncNow') }}</AppButton>
		</template>
	</AppPopover>
</template>
<script setup>
import { NuxtLink } from '#components'
import { getSyncStatus } from '../../../shared/utils/syncStatus.js'
const { t } = useI18n()
const { state, sync, boot, resolveQueue } = useNotes()
const open = ref(false)
const online = ref(true)
const trigger = ref(null)
const presentation = computed(() => getSyncStatus({ online: online.value, sync: state.value.sync, error: state.value.error, importPhase: state.value.importTask.phase }))
const status = computed(() => presentation.value.status)
const message = computed(() => t(presentation.value.title))
const color = computed(() => ({ success: 'text-(--status-ok)', warning: 'text-(--status-warning)', error: 'text-(--status-error)', neutral: 'text-(--muted)' })[presentation.value.severity])
const icon = computed(() => ({ synced: 'Check', error: 'CircleAlert', offline: 'CloudOff', local: 'CloudUpload', syncing: 'LoaderCircle', loading: 'LoaderCircle' })[status.value] || 'CircleAlert')
const retry = async () => {
	try { await (state.value.ready ? sync(true) : boot()) }
	catch (error) { state.value.error = error.code || 'serverError' }
}
const updateOnline = () => { online.value = navigator.onLine }
watch(() => state.value.panel, (panel) => { if (panel) open.value = false })
watch(open, (value) => { if (value) state.value.panel = null })
onMounted(() => {
	updateOnline()
	window.addEventListener('online', updateOnline)
	window.addEventListener('offline', updateOnline)
})
onBeforeUnmount(() => {
	window.removeEventListener('online', updateOnline)
	window.removeEventListener('offline', updateOnline)
})
</script>
