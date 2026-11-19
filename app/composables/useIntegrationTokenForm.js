export const useIntegrationTokenForm = ({ apiEnabled, mcpEnabled, projects, saving }) => {
	const tokenValues = reactive({ name: '', type: '', permission: 'read', projects: [] })
	const integrationOptions = computed(() => [
		...(mcpEnabled.value ? [{ value: 'mcp', label: 'MCP' }] : []),
		...(apiEnabled.value ? [{ value: 'api', label: 'API' }] : [])
	])
	const tokenFormDisabled = computed(() => saving.value || !integrationOptions.value.length)
	const allowedProjects = computed(() => projects.value.filter(project => project.kind === 'project' && project.status === 'active' && project[`${tokenValues.type}Enabled`]))
	const allowedProjectIds = computed(() => new Set(allowedProjects.value.map(project => project.id)))
	watch(() => integrationOptions.value.map(option => option.value).join(','), () => {
		if (!integrationOptions.value.some(option => option.value === tokenValues.type)) tokenValues.type = integrationOptions.value[0]?.value || ''
	}, { immediate: true, flush: 'sync' })
	watch(() => `${tokenValues.type}:${allowedProjects.value.map(project => project.id).join(',')}`, () => {
		tokenValues.projects = tokenValues.projects.filter(id => allowedProjectIds.value.has(id))
	}, { immediate: true, flush: 'sync' })
	const canCreateToken = computed(() => !tokenFormDisabled.value && !!tokenValues.name.trim()
		&& integrationOptions.value.some(option => option.value === tokenValues.type)
		&& ['read', 'write'].includes(tokenValues.permission)
		&& tokenValues.projects.length > 0 && tokenValues.projects.every(id => allowedProjectIds.value.has(id)))
	return { tokenValues, integrationOptions, tokenFormDisabled, allowedProjectIds, canCreateToken }
}
