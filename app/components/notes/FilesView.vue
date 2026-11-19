<template>
	<section data-files-view class="p-5 sm:px-6">
		<div class="mb-5 flex flex-wrap items-center gap-4">
			<label class="flex min-w-0 flex-1 items-center gap-2"><LucideSearch class="size-4 shrink-0" /><input v-model="query" type="search" :aria-label="t('searchFiles')" :placeholder="t('searchFiles')" class="min-w-0 w-full max-w-md rounded border border-(--line) bg-(--surface) px-3 py-2" /></label>
			<label class="flex items-center gap-2"><input v-model="unused" type="checkbox" />{{ t('unusedFiles') }}</label>
		</div>
		<p v-if="error" role="alert" class="error-message mb-3">{{ t(error) }} <button class="underline" @click="refreshFiles">{{ t('retryFiles') }}</button></p>
		<p v-if="!loaded && !error" class="py-8 text-(--muted)">{{ t('loading') }}</p>
		<p v-else-if="!rows.length" class="py-8 text-(--muted)">{{ t('noFiles') }}</p>
		<div v-else class="overflow-x-auto">
			<table class="w-full text-left text-[14px]">
				<thead><tr class="border-b border-(--line) text-(--muted)">
					<th v-for="column in columns" :key="column.key" class="px-3 py-3 font-medium" :aria-sort="sort === column.key ? (descending ? 'descending' : 'ascending') : 'none'"><button class="flex items-center gap-1 whitespace-nowrap" @click="sortBy(column.key)">{{ t(column.label) }}<LucideChevronDown v-if="sort === column.key" class="size-4" :class="!descending && 'rotate-180'" /></button></th>
					<th class="px-3 py-3 font-medium">{{ t('usedIn') }}</th><th class="relative"><span class="sr-only">{{ t('fileActions') }}</span></th>
				</tr></thead>
				<tbody><tr v-for="file in rows" :key="file.id" :data-file-id="file.id" class="border-b border-(--line) hover:bg-(--soft)">
					<td class="px-3 py-3"><button class="flex items-center gap-2 text-left text-(--accent)" :disabled="file.deleted" @click="downloadFile(file.id)"><AppIcon :name="file.type.startsWith('image/') ? 'Image' : 'FileText'" class="shrink-0" /><span class="min-w-[140px] max-w-[300px] break-words">{{ file.name }}<span v-if="file.deletionPending" class="block text-(--status-error)">{{ t('fileDeletionPending') }}</span></span></button></td>
					<td class="whitespace-nowrap px-3 py-3 text-(--muted)">{{ fileType(file) }}</td>
					<td class="whitespace-nowrap px-3 py-3 text-(--muted)">{{ fileSize(file.size) }}</td>
					<td class="whitespace-nowrap px-3 py-3 text-(--muted)">{{ file.createdAt ? formatDateTime(file.createdAt, state.workspace.preferences) : '—' }}</td>
					<td class="px-3 py-3"><div class="flex min-w-[130px] flex-col items-start gap-1"><button v-for="node in file.references" :key="node.id" class="text-left text-(--accent) hover:underline" @click="openDocument(node.id)">{{ node.title }}</button><span v-if="!file.references.length" class="text-(--muted)">{{ t('unusedFile') }}</span></div></td>
					<td class="px-2 py-2"><button :aria-label="`${t('fileActions')}: ${file.name}`" class="rounded p-2 hover:bg-(--surface)" @click="openMenu(file.id, $event)"><LucideEllipsis class="size-4" /></button></td>
				</tr></tbody>
			</table>
		</div>
		<FileActions v-if="menu" :id="menu.id" :anchor="() => menu?.anchor" @close="menu = null" @remove="remove(menu.id)" />
	</section>
</template>
<script setup>
import { formatDateTime } from '../../../shared/utils/dateTime.js'
const { t, locale } = useI18n()
const { state, openDocument } = useNotes()
const { files, loaded, error, refreshFiles, downloadFile, removeFile } = useFiles()
const query = ref(''), unused = ref(false), sort = ref('createdAt'), descending = ref(true), menu = shallowRef(null)
const columns = [{ key: 'name', label: 'fileName' }, { key: 'type', label: 'fileType' }, { key: 'size', label: 'fileSize' }, { key: 'createdAt', label: 'fileUploaded' }]
const rows = computed(() => files.value.filter((file) => (!file.deleted || file.deletionPending) && (!unused.value || !file.references.length) && file.name.toLocaleLowerCase().includes(query.value.toLocaleLowerCase())).sort((a, b) => {
	const result = sort.value === 'size' ? a.size - b.size : String(sort.value === 'type' ? fileType(a) : a[sort.value] || '').localeCompare(String(sort.value === 'type' ? fileType(b) : b[sort.value] || ''), locale.value, { numeric: true })
	return (descending.value ? -result : result) || a.id.localeCompare(b.id)
}))
const fileType = (file) => file.name.split('.').length > 1 ? file.name.split('.').pop().toUpperCase() : file.type
const fileSize = (size) => size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(size / 1024)} KB` : `${new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(size / (1024 * 1024))} MB`
const sortBy = (key) => {
	descending.value = sort.value === key ? !descending.value : key === 'createdAt'
	sort.value = key
}
const openMenu = (id, event) => { menu.value = { id, anchor: event.currentTarget } }
const removing = ref(false)
const remove = async (id) => {
	if (removing.value) return
	removing.value = true
	try { if (await removeFile(id)) await refreshFiles() }
	catch (e) { error.value = e.code || 'serverError' }
	finally { removing.value = false }
}
let interval
onMounted(() => {
	refreshFiles()
	interval = setInterval(refreshFiles, 5000)
})
onBeforeUnmount(() => clearInterval(interval))
</script>
