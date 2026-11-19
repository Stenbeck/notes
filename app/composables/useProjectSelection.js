export const useProjectSelection = ({ projects, allowedIds, initialSelection }) => {
	const query = ref('')
	const selected = ref([...initialSelection.value])
	const visibleProjects = computed(() => {
		const term = query.value.trim().toLocaleLowerCase()
		return projects.value.filter(project => project.title.toLocaleLowerCase().includes(term))
			.sort((left, right) => Number(allowedIds.value.has(right.id)) - Number(allowedIds.value.has(left.id)))
	})
	const eligibleSelection = computed(() => selected.value.filter(id => allowedIds.value.has(id)))
	watch(allowedIds, () => { selected.value = eligibleSelection.value }, { immediate: true, flush: 'sync' })
	const selectVisible = () => {
		selected.value = [...new Set([...eligibleSelection.value, ...visibleProjects.value.filter(project => allowedIds.value.has(project.id)).map(project => project.id)])]
	}
	const clear = () => { selected.value = [] }
	return { query, selected, visibleProjects, eligibleSelection, selectVisible, clear }
}
