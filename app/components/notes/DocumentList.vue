<template>
	<div>
		<div v-for="node in nodes" :key="node.id"
			class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-(--line) px-2 py-2 hover:bg-(--soft) focus-within:bg-(--soft)"
			:class="inactive ? 'sm:grid-cols-[minmax(0,1fr)_150px_auto]' : showDate ? 'sm:grid-cols-[minmax(0,1fr)_80px_150px]' : 'grid-cols-[minmax(0,1fr)_auto]!'"
			:draggable="!inactive && node.kind === 'document'" @dragstart="drag($event, node)" @click="open(node)">
			<div class="flex min-w-0 items-center gap-1">
				<button v-if="!inactive" class="touch-none p-1 [@media(hover:hover)]:hidden" :aria-label="t('move')" @click.stop @pointerdown.stop="start($event, node)"><AppIcon name="GripVertical" /></button>
				<component :is="inactive && node.kind === 'project' ? 'span' : 'button'" class="flex min-w-0 items-center gap-2 text-left" @click.stop="open(node)">
					<AppIcon :name="node.kind === 'project' ? node.icon || 'Folder' : 'FileText'" :style="node.kind === 'project' ? { color: node.color } : undefined" />
					<span class="min-w-0"><span class="block truncate">{{ node.title }}</span><span v-if="inactive && nestedCount(node)" class="block text-[14px] text-(--muted)">{{ t('nestedItems', { count: nestedCount(node) }) }}</span></span>
					<LucideGlobe v-if="!inactive && effectiveShare(state.workspace, node.id)" class="size-3 shrink-0 text-(--accent) sm:hidden" :aria-label="t('shared')" />
				</component>
			</div>
			<span v-if="!inactive" class="hidden text-[14px] text-(--muted) sm:block">{{ effectiveShare(state.workspace, node.id) ? t('shared') : '' }}</span>
			<span v-if="showDate" class="whitespace-nowrap text-[14px] text-(--muted)" :class="inactive ? 'hidden sm:block' : ''">{{ formatDateTime(node.updatedAt, state.workspace.preferences) }}</span>
			<div v-if="inactive" class="flex items-center gap-1" @click.stop>
				<button type="button" :disabled="busy" :aria-label="t('restoreNamed', { name: node.title })" :title="t('restore')" class="rounded p-1.5 hover:bg-(--soft) disabled:opacity-50" @click="emit('restore', node.id)"><LucideRotateCcw class="size-4" /></button>
				<button v-if="trash" type="button" :disabled="busy" :aria-label="t('deleteNamed', { name: node.title })" :title="t('deleteForever')" class="rounded p-1.5 text-(--status-error) hover:bg-(--danger-soft) disabled:opacity-50" @click="emit('remove', node.id)"><LucideTrash2 class="size-4" /></button>
			</div>
		</div>
		<p v-if="!nodes.length" class="py-5 text-(--muted)">{{ t(trash ? 'trashIsEmpty' : 'empty') }}</p>
	</div>
</template>
<script setup>
import { formatDateTime } from '../../../shared/utils/dateTime.js'
import { descendants } from '../../../shared/utils/structure.js'
const props = defineProps({ nodes: { type: Array, default: () => [] }, showDate: { type: Boolean, default: true }, inactive: Boolean, trash: Boolean, busy: Boolean })
const emit = defineEmits(['restore', 'remove'])
const { t } = useI18n()
const { start } = useTreeDrag()
const { state, select, openDocument, effectiveShare } = useNotes()
const nestedCount = (node) => descendants(state.value.workspace, node.id).length
const open = (node) => {
	if (props.inactive && node.kind === 'project') return
	if (node.kind === 'project') select('project', node.id)
	else openDocument(node.id)
}
const drag = (event, node) => {
	event.dataTransfer.setData('text/notes-id', node.id)
	event.dataTransfer.effectAllowed = 'move'
}
</script>
