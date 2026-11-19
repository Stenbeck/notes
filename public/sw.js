const SHELL = 'notes-shell-v3'
const FILES = 'notes-private-files-v1'
const ASSETS = ['/', '/icon.svg', '/favicon.ico', '/apple-touch-icon.png', '/apple-touch-icon-167.png', '/apple-touch-icon-152.png', '/icon-192.png', '/icon-512.png', '/icon-maskable-192.png', '/icon-maskable-512.png', '/safari-pinned-tab.svg', '/manifest.webmanifest']
self.addEventListener('install', event => {
	event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(ASSETS)))
})
self.addEventListener('activate', event => {
	event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('notes-shell-') && key !== SHELL).map(key => caches.delete(key)))))
})
self.addEventListener('fetch', event => {
	const url = new URL(event.request.url)
	if (event.request.method !== 'GET' || url.origin !== self.location.origin) return
	if ((url.pathname.startsWith('/api/files/') && !url.searchParams.has('share')) || url.pathname === '/api/app/avatar') {
		event.respondWith(caches.open(FILES).then(async cache => {
			try {
				const response = await fetch(event.request)
				if (response.ok) await cache.put(event.request, response.clone())
				else await cache.delete(event.request)
				return response
			} catch { return (await cache.match(event.request)) || new Response('', { status: 503 }) }
		}))
		return
	}
	if (url.pathname === '/connect' || url.pathname === '/mcp' || url.pathname.startsWith('/oauth/') || url.pathname.startsWith('/.well-known/') || url.pathname.startsWith('/api/') || url.pathname.startsWith('/p/') || url.pathname.startsWith('/setup') || url.pathname.startsWith('/login')) return
	if (url.pathname.startsWith('/_nuxt/') || url.pathname.startsWith('/_i18n/')) event.respondWith(caches.open(SHELL).then(async cache => {
		const cached = await cache.match(event.request)
		if (cached) return cached
		const response = await fetch(event.request)
		if (response.ok) await cache.put(event.request, response.clone())
		return response
	}))
	else if (ASSETS.includes(url.pathname)) event.respondWith(fetch(event.request).catch(() => caches.match(event.request)))
	else if (event.request.mode === 'navigate') event.respondWith(fetch(event.request).catch(() => caches.match('/')))
})
