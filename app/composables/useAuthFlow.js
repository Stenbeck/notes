const authErrorCode = (failure, fallback) => {
	const code = failure?.code || failure?.data?.code || failure?.data?.error
	if (['AUTH_CANCELLED', 'REGISTRATION_CANCELLED', 'ERROR_CEREMONY_ABORTED'].includes(code)) return 'passkeyCancelled'
	if (code === 'NO_PASSKEYS_REGISTERED') return 'passkeyNoneRegistered'
	if (code === 'PASSKEY_NOT_FOUND') return 'passkeyNotFound'
	if (code === 'PREVIOUSLY_REGISTERED') return 'passkeyAlreadyRegistered'
	if (code === 'CHALLENGE_NOT_FOUND') return 'passkeyChallengeExpired'
	if (['authConfiguration', 'databaseConfiguration', 'smtpConfiguration', 'rateLimited', 'invalidToken', 'setupClosed'].includes(code)) return code
	return fallback
}
export const useAuthFlow = () => {
	const { $auth } = useNuxtApp()
	const route = useRoute()
	const router = useRouter()
	const document = computed(() => typeof route.query.document === 'string' ? route.query.document : '')
	const documentPath = () => document.value ? `/doc/${encodeURIComponent(document.value)}` : '/'
	const busy = ref(false)
	const error = ref('')
	const notice = ref('')
	const result = (response) => {
		if (response.error) throw Object.assign(new Error('Authentication failed'), { code: typeof response.error === 'string' ? response.error : response.error.code })
		return response.data
	}
	const run = async (action, fallback = 'authFailed') => {
		if (busy.value) return
		busy.value = true
		error.value = ''
		notice.value = ''
		try {
			return await action()
		} catch (failure) {
			error.value = authErrorCode(failure, fallback)
		} finally {
			busy.value = false
		}
	}
	const signedIn = async () => {
		const session = result(await $auth.getSession({ query: { disableCookieCache: true }, fetchOptions: { cache: 'no-store' } }))
		if (!session?.user) throw new Error('Session missing')
		await navigateTo(documentPath(), { replace: true })
	}
	const signInPasskey = () => run(async () => {
		result(await $auth.signIn.passkey())
		await signedIn()
	}, 'passkeyFailed')
	const sendLink = (email) => run(async () => {
		const callbackURL = router.resolve({ path: '/welcome', query: { document: document.value || undefined } }).href
		result(await $auth.signIn.magicLink({ email, callbackURL }))
		notice.value = 'signInLinkSent'
	})
	const registerPasskey = (name) => run(async () => {
		result(await $auth.passkey.addPasskey({ name: name.trim() || 'Notes', createSession: true }))
		await signedIn()
	})
	return { documentPath, busy, error, notice, run, result, signedIn, signInPasskey, sendLink, registerPasskey }
}
