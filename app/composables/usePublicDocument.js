export const usePublicDocument = () => {
	const route = useRoute()
	const { t, locale, setLocale } = useI18n()
	const data = ref(null),
		password = ref(''),
		error = ref(''),
		child = ref(route.query.document || null)
	const documentHTML = computed(() => {
		if (!data.value?.html) return ''
		const parsed = new DOMParser().parseFromString(data.value.html, 'text/html')
		for (const marker of parsed.querySelectorAll('[data-missing-file]'))
			marker.textContent = `${t('fileMissing')}${marker.textContent ? `: ${marker.textContent}` : ''}`
		return parsed.body.innerHTML
	})
	let interval, active, sequence = 0
	const endpoint = () =>
		`/api/public/${encodeURIComponent(route.params.slug)}${child.value ? '/' + encodeURIComponent(child.value) : ''}`
	const load = () => {
		const path = endpoint()
		if (active?.path === path) return active.task
		const current = ++sequence
		const task = (async () => {
			try {
				const response = await $fetch(path)
				if (current !== sequence) return
				if (response.success) {
					data.value = response.data
					error.value = ''
				} else error.value = response.error
			} catch (e) {
				if (current !== sequence) return
				error.value = e.data?.error || 'notFound'
				data.value = null
			} finally {
				if (current === sequence) active = null
			}
		})()
		active = { path, task }
		return task
	}
	const selectChild = (id) => {
		child.value = id
		load()
	}
	const unlock = async () => {
		try {
			await $fetch(endpoint(), { method: 'POST', body: { password: password.value } })
			password.value = ''
			sequence++
			active = null
			await load()
		} catch (e) {
			error.value = e.data?.error || 'wrongPassword'
		}
	}
	onMounted(() => {
		load()
		interval = setInterval(load, 1500)
	})
	onBeforeUnmount(() => {
		sequence++
		clearInterval(interval)
	})
	return { t, locale, setLocale, data, password, error, child, documentHTML, selectChild, unlock }
}
