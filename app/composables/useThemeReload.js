const storageKey = 'notes-theme-reload'

export const useThemeReload = () => {
	const { state, prepareReload, select } = useNotes()
	const scrollTop = useState('theme-reload-scroll', () => null)
	const reload = async () => {
		await prepareReload()
		sessionStorage.setItem(storageKey, JSON.stringify({
			userId: state.value.user?.id,
			path: location.pathname + location.search,
			view: state.value.view,
			selected: state.value.selected,
			scrollTop: document.querySelector('[role="dialog"] > .overflow-y-auto')?.scrollTop || 0
		}))
		location.reload()
	}
	const restore = async () => {
		const stored = sessionStorage.getItem(storageKey)
		if (!stored) return
		sessionStorage.removeItem(storageKey)
		let saved
		try { saved = JSON.parse(stored) } catch { return }
		if (saved.userId !== state.value.user?.id || saved.path !== location.pathname + location.search) return
		if (saved.view !== 'document') select(saved.view, saved.selected)
		await nextTick()
		await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
		scrollTop.value = saved.scrollTop
		state.value.panel = { type: 'profile' }
	}
	return { reload, restore, scrollTop }
}
