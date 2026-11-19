export const usePhoneLandscape = () => {
	const phoneLandscape = ref(false)
	let touchScreen
	const update = () => {
		// Use the physical screen so the keyboard cannot turn portrait into landscape.
		const screen = window.screen
		const orientation = screen.orientation?.type
		const landscape = orientation ? orientation.startsWith('landscape') : typeof window.orientation === 'number' ? Math.abs(window.orientation) === 90 : screen.width > screen.height
		phoneLandscape.value = touchScreen.matches && Math.min(screen.width, screen.height) < 600 && landscape
	}
	onMounted(() => {
		touchScreen = window.matchMedia('(any-pointer: coarse)')
		touchScreen.addEventListener('change', update)
		window.addEventListener('resize', update)
		window.addEventListener('orientationchange', update)
		window.screen.orientation?.addEventListener('change', update)
		update()
	})
	onBeforeUnmount(() => {
		touchScreen?.removeEventListener('change', update)
		window.removeEventListener('resize', update)
		window.removeEventListener('orientationchange', update)
		window.screen.orientation?.removeEventListener('change', update)
	})
	return phoneLandscape
}
