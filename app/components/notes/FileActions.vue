<template>
	<AppPopover :title="t('fileActions')" :anchor="anchor" menu @close="$emit('close')">
		<button role="menuitem" :disabled="findFile(id)?.deleted" class="flex w-full items-center gap-2 whitespace-nowrap rounded px-3 py-2 hover:bg-(--soft)" @click="download"><LucideDownload class="size-4" />{{ t('downloadFile') }}</button>
		<button role="menuitem" class="flex w-full items-center gap-2 whitespace-nowrap rounded px-3 py-2 text-(--status-error) hover:bg-(--danger-soft)" @click="remove"><LucideTrash2 class="size-4" />{{ t('deleteFile') }}…</button>
	</AppPopover>
</template>
<script setup>
const props = defineProps({ id: String, anchor: Function })
const emit = defineEmits(['close', 'remove'])
const { t } = useI18n()
const { downloadFile, findFile } = useFiles()
const download = () => {
	downloadFile(props.id)
	emit('close')
}
const remove = () => {
	emit('remove')
	emit('close')
}
</script>
