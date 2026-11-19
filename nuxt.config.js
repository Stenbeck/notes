import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
	compatibilityDate: '2026-10-01',
	devtools: { enabled: false },
	components: [{ path: '~/components', pathPrefix: false }],
	css: ['~/assets/css/main.css'],
	modules: ['@nuxtjs/i18n', 'nuxt-lucide-icons'],
	vite: {
		plugins: [tailwindcss()],
		optimizeDeps: {
			include: [
				'@better-auth/passkey/client',
				'@tiptap/core',
				'@tiptap/extension-collaboration',
				'@tiptap/extension-image',
				'@tiptap/extension-list',
				'@tiptap/extension-table',
				'@tiptap/starter-kit',
				'@tiptap/vue-3',
				'better-auth/vue',
				'idb',
				'y-indexeddb',
				'yjs'
			]
		}
	},
	hooks: {
		'pages:extend': (pages) => {
			pages.push({ name: 'private-document', path: '/doc/:id', file: fileURLToPath(new URL('./app/pages/index.vue', import.meta.url)), meta: { key: 'workspace' } })
		}
	},
	i18n: {
		strategy: 'no_prefix',
		defaultLocale: 'en',
		locales: [
			{ code: 'en', file: 'en.json' },
			{ code: 'sv', file: 'sv.json' }
		],
		detectBrowserLanguage: { useCookie: true, cookieKey: 'notes_locale', redirectOn: 'root' }
	},
	app: {
		head: {
			title: 'Notes',
			meta: [
				{ name: 'viewport', content: 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover' },
				{ name: 'theme-color', content: '#ffffff' },
				{ name: 'mobile-web-app-capable', content: 'yes' },
				{ name: 'apple-mobile-web-app-capable', content: 'yes' },
				{ name: 'apple-mobile-web-app-title', content: 'Notes' },
				{ name: 'apple-mobile-web-app-status-bar-style', content: 'default' }
			],
			link: [
				{ rel: 'manifest', href: '/manifest.webmanifest' },
				{ rel: 'icon', href: '/favicon.ico', sizes: '16x16 32x32 48x48' },
				{ rel: 'icon', href: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
				{ rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' },
				{ rel: 'apple-touch-icon', href: '/apple-touch-icon-167.png', sizes: '167x167' },
				{ rel: 'apple-touch-icon', href: '/apple-touch-icon-152.png', sizes: '152x152' },
				{ rel: 'mask-icon', href: '/safari-pinned-tab.svg', color: '#655277' }
			]
		}
	},
	nitro: {
		preset: 'node-server',
		// Bundle shared application code so dev output cannot externalize it to a stale relative path.
		externals: { inline: [fileURLToPath(new URL('./shared/', import.meta.url))] }
	}
})
