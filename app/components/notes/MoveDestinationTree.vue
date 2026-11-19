<template>
	<ul class="space-y-0.5">
		<li v-for="target in nodes" :key="target.id">
			<div class="flex items-center gap-1 rounded" :class="selected === target.id ? 'bg-(--soft)' : 'hover:bg-(--soft)'">
				<button v-if="children(target.id).length" type="button" class="shrink-0 p-1"
					:aria-label="`${t(expanded.includes(target.id) ? 'collapse' : 'expand')} ${target.title}`"
					:aria-expanded="expanded.includes(target.id)" :disabled="disabled" @click="toggle(target.id)">
					<AppIcon :name="expanded.includes(target.id) ? 'ChevronDown' : 'ChevronRight'" />
				</button>
				<span v-else class="w-6 shrink-0" />
				<button type="button" class="flex min-w-0 flex-1 items-center gap-2 px-1 py-1.5 text-left"
					:aria-pressed="selected === target.id" :disabled="disabled" @click="selected = target.id">
					<AppIcon :name="target.kind === 'project' ? target.icon || 'Folder' : 'FileText'" :style="target.kind === 'project' ? { color: target.color } : undefined" />
					<span class="min-w-0 wrap-break-word">{{ target.title }}</span>
				</button>
			</div>
			<div v-if="expanded.includes(target.id)" class="ml-3 border-l border-(--line) pl-1">
				<MoveDestinationTree :nodes="children(target.id)" :excluded="excluded" :disabled="disabled" :projects-only="projectsOnly"
					v-model="selected" v-model:expanded="expanded" />
			</div>
		</li>
	</ul>
</template>
<script setup>
const props = defineProps({ nodes: Array, excluded: { type: Set, required: true }, disabled: Boolean, projectsOnly: Boolean })
const selected = defineModel()
const expanded = defineModel('expanded', { required: true })
const { state, childrenOf } = useNotes()
const { t } = useI18n()
const children = (id) => props.projectsOnly ? [] : childrenOf(state.value.workspace, id).filter(node => !props.excluded.has(node.id))
const toggle = (id) => {
	expanded.value = expanded.value.includes(id) ? expanded.value.filter(value => value !== id) : [...expanded.value, id]
}
</script>
