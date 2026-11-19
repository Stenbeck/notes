<template>
	<form id="integration-project-picker" class="flex h-[min(65dvh,560px)] min-h-0 flex-1 flex-col" @submit.prevent="apply">
		<div data-project-search class="shrink-0 space-y-3 border-b border-(--line) px-5 py-3">
			<p v-if="editingToken" class="text-(--muted)">{{ t('editTokenProjectsHelp', { name: editingToken.name }) }}</p>
			<p v-if="hasUnavailableSelection" class="text-(--muted)">{{ t('unavailableTokenProjectsRemoved') }}</p>
			<label for="integration-project-search" class="sr-only">{{ t('searchProjects') }}</label>
			<SettingsInput id="integration-project-search" ref="search" v-model="query" type="search" :placeholder="t('searchProjects')" :disabled="disabled" />
			<div class="flex flex-wrap items-center justify-between gap-2">
				<p class="text-(--muted)" role="status">{{ t('projectsSelected', { count: eligibleSelection.length }) }}</p>
				<div class="flex flex-wrap gap-2">
					<AppButton :disabled="disabled || !visibleProjects.some(project => allowedIds.has(project.id))" @click="selectVisible">{{ t('selectVisibleProjects') }}</AppButton>
					<AppButton :disabled="disabled || !eligibleSelection.length" @click="clear">{{ t('clearProjectSelection') }}</AppButton>
				</div>
			</div>
			<p v-if="projects.some(project => !allowedIds.has(project.id))" id="project-access-help" class="text-(--muted)">{{ t('lockedIntegrationProjects', { integration: integration.toUpperCase() }) }}</p>
		</div>
		<div data-project-list class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-1">
			<label v-for="project in visibleProjects" :key="project.id" class="flex min-h-11 items-center gap-3 border-b border-(--line) py-2 last:border-b-0" :class="allowedIds.has(project.id) ? 'cursor-pointer hover:bg-(--soft)' : 'text-(--muted)'">
				<input v-model="selected" type="checkbox" :value="project.id" :disabled="disabled || !allowedIds.has(project.id)" :aria-label="project.title" :aria-describedby="!allowedIds.has(project.id) ? 'project-access-help' : undefined" class="size-4 shrink-0" />
				<span class="min-w-0 flex-1 break-words">{{ project.title }}</span>
				<LucideLockKeyhole v-if="!allowedIds.has(project.id)" class="size-4 shrink-0" aria-hidden="true" />
			</label>
			<p v-if="!visibleProjects.length" class="py-3 text-(--muted)">{{ t('noMatchingProjects') }}</p>
		</div>
	</form>
</template>
<script setup>
const props = defineProps({ projects: { type: Array, required: true }, allowedIds: { type: Set, required: true }, selection: { type: Array, required: true }, disabled: Boolean, editingToken: Object, hasUnavailableSelection: Boolean, integration: { type: String, required: true } })
const emit = defineEmits(['apply'])
const { t } = useI18n()
const { query, selected, visibleProjects, eligibleSelection, selectVisible, clear } = useProjectSelection({ projects: toRef(props, 'projects'), allowedIds: toRef(props, 'allowedIds'), initialSelection: toRef(props, 'selection') })
const search = ref(null)
const apply = () => { if (!props.disabled) emit('apply', [...eligibleSelection.value]) }
onMounted(() => search.value?.$el.focus())
</script>
