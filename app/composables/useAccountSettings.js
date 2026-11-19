export const useAccountSettings = () => {
	const { $auth } = useNuxtApp()
	const { state, refresh } = useNotes()
	const { t } = useI18n()
	const { ask } = useConfirmation()
	const name = ref(state.value.user?.name || '')
	const email = ref(state.value.user?.email || '')
	const keyName = ref('')
	const passkeys = ref([])
	const busy = ref(false)
	const error = ref('')
	const notice = ref('')
	const result = (response) => {
		if (response.error) throw Object.assign(new Error('Account operation failed'), { code: response.error.code })
		return response.data
	}
	const run = async (action) => {
		if (busy.value) return
		busy.value = true
		error.value = ''
		notice.value = ''
		try {
			await action()
		} catch (failure) {
			error.value = ['SESSION_EXPIRED', 'UNAUTHORIZED', 'SESSION_REQUIRED', 'unauthorized'].includes(failure.code)
				? 'freshLoginRequired'
				: 'accountUpdateFailed'
		} finally {
			busy.value = false
		}
	}
	const loadKeys = async () => { passkeys.value = (result(await $auth.passkey.listUserPasskeys()) || []).map((key) => ({ ...key, name: key.name || 'Notes' })) }
	const saveName = () => run(async () => {
		result(await $auth.updateUser({ name: name.value.trim() }))
		await refresh()
		notice.value = 'profileSaved'
	})
	const changeEmail = () => run(async () => {
		result(await $auth.changeEmail({ newEmail: email.value.trim(), callbackURL: '/' }))
		notice.value = 'emailChangeSent'
	})
	const addKey = () => {
		const name = keyName.value.trim()
		if (!name) return
		return run(async () => {
			result(await $auth.passkey.addPasskey({ name }))
			keyName.value = ''
			await loadKeys()
			notice.value = 'passkeyAdded'
		})
	}
	const renameKey = (key) => run(async () => {
		result(await $auth.passkey.updatePasskey({ id: key.id, name: key.name.trim() }))
		await loadKeys()
		notice.value = 'profileSaved'
	})
	const removeKey = async (key) => {
		if (!await ask(t('removePasskeyConfirm'))) return
		return run(async () => {
			result(await $auth.passkey.deletePasskey({ id: key.id }))
			await loadKeys()
			notice.value = 'passkeyRemoved'
		})
	}
	onMounted(() => run(loadKeys))
	return { state, name, email, keyName, passkeys, busy, error, notice, saveName, changeEmail, addKey, renameKey, removeKey }
}
