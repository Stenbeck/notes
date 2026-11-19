export default defineNuxtPlugin((nuxtApp) => {
	const color = ref('#ffffff')
	useHead({ meta: [{ name: 'theme-color', content: color }] })
	const update = () => {
		const styles = getComputedStyle(document.documentElement)
		color.value = styles.getPropertyValue('--browser-background').trim() || '#ffffff'
	}
	const observer = new MutationObserver(update)
	const scheme = matchMedia('(prefers-color-scheme: dark)')
	nuxtApp.hook('app:mounted', () => {
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-appearance'] })
		scheme.addEventListener('change', update)
		update()
	})
	nuxtApp.hook('page:finish', update)
	if (import.meta.hot) import.meta.hot.dispose(() => {
		observer.disconnect()
		scheme.removeEventListener('change', update)
	})
})
