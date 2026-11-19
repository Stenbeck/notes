let trigger
let bounds
export const useNotesPanel = () => {
	const { state } = useNotes()
	const getPanelTrigger = () => trigger
	const getPanelBounds = () => {
		const current = trigger?.getBoundingClientRect()
		if (current?.width && current?.height) bounds = current
		return bounds
	}
	const openPanel = (type, id, event) => {
		const next = event?.currentTarget || document.activeElement
		if (state.value.panel?.type === type && state.value.panel?.id === id && trigger === next) {
			state.value.panel = null
			return
		}
		trigger = next
		bounds = trigger?.getBoundingClientRect()
		state.value.panel = { type, id }
		state.value.mobile = false
	}
	return { openPanel, getPanelTrigger, getPanelBounds }
}
