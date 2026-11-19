export const useSetupFlow = () => {
	const { error, busy, run } = useAuthFlow()
	const values = reactive({ token: '', email: '', name: '' })
	const checking = ref(true)
	const notice = ref('')
	const verifying = ref(false)
	const call = async (path, body) => {
		const response = await $fetch(`/api/setup/${path}`, { method: 'POST', body })
		if (!response.success) throw Object.assign(new Error('Setup failed'), { code: response.error })
		return response.data
	}
	const begin = () => run(async () => {
		await call('begin', values)
		notice.value = 'checkEmail'
	})
	const checkSetup = async () => {
		if (busy.value) return
		const token = new URLSearchParams(location.hash.slice(1)).get('verify')
		if (token) {
			verifying.value = true
			history.replaceState(null, '', '/setup')
			await run(async () => {
				await call('verify', { token })
				await navigateTo('/welcome', { replace: true })
			})
		} else {
			try {
				const response = await $fetch('/api/setup/status')
				if (response.data?.complete) await navigateTo('/login', { replace: true })
			} catch { error.value = 'databaseConfiguration' }
		}
		checking.value = false
	}
	onMounted(() => {
		checkSetup()
		window.addEventListener('hashchange', checkSetup)
	})
	onBeforeUnmount(() => window.removeEventListener('hashchange', checkSetup))
	return { values, checking, verifying, busy, error, notice, begin }
}
