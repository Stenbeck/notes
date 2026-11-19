export const useMcpConsent = () => {
	const route = useRoute()
	const { request } = useNotesRequest()
	const consent = ref(null)
	const tokenId = ref('')
	const busy = ref(false)
	const error = ref('')
	const selected = computed(() => consent.value?.tokens.find(token => token.id === tokenId.value))
	const load = async () => {
		if (busy.value) return
		busy.value = true
		error.value = ''
		consent.value = null
		try {
			consent.value = await request(`oauth/consent?${new URLSearchParams(route.query)}`, { cache: 'no-store' })
			tokenId.value = consent.value.tokens[0]?.id || ''
		} catch (failure) {
			error.value = failure.code === 'unauthorized' ? 'unauthorized' : 'mcpConnectFailed'
		} finally { busy.value = false }
	}
	const decide = async approved => {
		if (busy.value) return
		busy.value = true
		error.value = ''
		try {
			const result = await request('oauth/consent', {
				method: 'POST', body: { request: route.query, tokenId: tokenId.value, approved }
			})
			await navigateTo(result.redirect, { external: true })
		} catch {
			error.value = 'mcpConnectFailed'
		} finally { busy.value = false }
	}
	onMounted(load)
	return { consent, tokenId, selected, busy, error, load, decide }
}
