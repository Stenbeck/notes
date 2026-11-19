const warmShell = async () => {
	await navigator.serviceWorker.register('/sw.js')
	await navigator.serviceWorker.ready
	const cache = await caches.open('notes-shell-v3')
	const urls = [...new Set(performance.getEntriesByType('resource').map((entry) => entry.name))]
	await Promise.allSettled(urls.map(async (value) => {
		const url = new URL(value)
		if (url.origin !== location.origin || (!url.pathname.startsWith('/_nuxt/') && !url.pathname.startsWith('/_i18n/'))) return
		if (await cache.match(url.href)) return
		const response = await fetch(url.href, { credentials: 'omit' })
		if (response.ok) await cache.put(url.href, response)
	}))
}
export default defineNuxtPlugin(() => {
	// Preserve public assets loaded before the service worker took control, including translations.
	if ('serviceWorker' in navigator && !import.meta.dev) warmShell().catch(() => {})
})
