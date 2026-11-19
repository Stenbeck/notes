<template>
	<div v-for="node in nodes" :key="node.id" data-tree-branch class="relative">
		<div
			class="group relative mb-0.5 flex min-h-7 items-center rounded inset-ring inset-ring-transparent hover:inset-ring-(--paper-hover-border) focus-within:inset-ring-(--paper-hover-border) hover:bg-(--soft) focus-within:bg-(--soft)"
			:data-drop-id="node.id"
			:class="state.selected === node.id ? 'bg-(--soft) inset-ring-(--paper-active-border)!' : ''"
			draggable="true"
			@dragstart="drag($event, node)"
		>
			<button
				class="mr-1.5 w-4 shrink-0 p-0.5"
				:aria-label="`${t(isOpen(node.id) ? 'collapse' : 'expand')} ${node.title}`"
				:aria-expanded="isOpen(node.id)"
				@click="toggle(node.id)"
			>
				<AppIcon
					v-if="hasChildren(node.id)"
					:name="isOpen(node.id) ? 'ChevronDown' : 'ChevronRight'"
					:size="12"
				/>
			</button>
			<button class="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left" @click="open(node)">
				<AppIcon
					v-if="node.kind === 'project'"
					:name="node.icon || 'Folder'"
					:style="{ color: node.color }"
				/><span class="truncate">{{ node.title }}</span>
			</button>
			<div class="hidden shrink-0 group-hover:flex group-focus-within:flex [@media(hover:none)]:flex">
				<button
					class="touch-none p-1 text-(--muted) [@media(hover:hover)]:hidden"
					:aria-label="t('move')"
					@pointerdown.stop="start($event, node)"
				>
					<AppIcon name="GripVertical" /></button
				><button class="p-1 text-(--muted)" :aria-label="t('newDocument')" @click="create(node.id)">
					<AppIcon name="Plus" /></button
				><button
					class="p-1 text-(--muted)"
					:aria-label="t('more')"
					@click="openPanel('actions', node.id, $event)"
				>
					<AppIcon name="Ellipsis" />
				</button>
			</div>
		</div>
		<div v-if="isOpen(node.id)" class="ml-3 border-l border-(--line) pl-1">
			<ProjectTree :nodes="childrenOf(state.workspace, node.id)" />
		</div>
	</div>
</template>
<script setup>
defineProps({ nodes: Array })
const { t } = useI18n()
const { openPanel } = useNotesPanel()
const { state, childrenOf, create, select, openDocument } = useNotes()
const { start } = useTreeDrag()
const isOpen = (id) => state.value.expanded.includes(id)
const hasChildren = (id) => childrenOf(state.value.workspace, id).length > 0
const toggle = (id) => {
	state.value.expanded = isOpen(id)
		? state.value.expanded.filter((x) => x !== id)
		: [...state.value.expanded, id]
}
const open = (node) => (node.kind === 'project' ? select('project', node.id) : openDocument(node.id))
const drag = (event, node) => {
	event.dataTransfer.setData('text/notes-id', node.id)
	event.dataTransfer.effectAllowed = 'move'
}
</script>
