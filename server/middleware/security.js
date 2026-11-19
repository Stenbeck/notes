import { configuration } from '../config/index.js'
import { rawHandler } from '../utils/responseHandler.js'
import { rateLimit } from '../services/rateLimit.js'
import { fail } from '../utils/publicError.js'

export default rawHandler(async (event) => {
	const url = getRequestURL(event)
	setHeader(event, 'X-Content-Type-Options', 'nosniff')
	setHeader(event, 'Referrer-Policy', 'no-referrer')
	setHeader(event, 'X-Frame-Options', 'DENY')
	setHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
	if (process.env.NODE_ENV === 'production') {
		setHeader(event, 'Strict-Transport-Security', 'max-age=31536000')
		setHeader(
			event,
			'Content-Security-Policy',
			"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
		)
	}
	if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/p/') || url.pathname === '/mcp' || url.pathname.startsWith('/oauth/') || url.pathname === '/connect')
		setHeader(event, 'Cache-Control', 'private, no-store')
	const integration = url.pathname.startsWith('/api/v1/') || url.pathname.startsWith('/api/integration/')
	if (url.pathname === '/mcp' || integration) rateLimit('integrationAddress', getRequestIP(event) || 'anonymous')
	const protocolEndpoint = ['/mcp', '/oauth/token', '/oauth/register'].includes(url.pathname)
	if (protocolEndpoint) {
		const origin = getHeader(event, 'origin')
		if (origin && origin !== configuration().baseURL) fail('forbidden', 403)
	}
	if (
		!protocolEndpoint &&
		['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.method) &&
		!integration
	) {
		const origin = getHeader(event, 'origin')
		if (!origin || origin !== configuration().baseURL) fail('forbidden', 403)
	}
	if (configuration().maintenance && !['GET', 'HEAD'].includes(event.method)) fail('maintenance', 503)
	if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.method)) {
		const limit = url.pathname.includes('/app/import')
			? 51 * 1024 * 1024
			: url.pathname.includes('/app/upload')
				? configuration().maxFileSize + 1024 * 1024
				: url.pathname === '/mcp' || url.pathname.includes('/documents/') || url.pathname.endsWith('/update')
					? 20 * 1024 * 1024
					: 1024 * 1024
		if (Number(getHeader(event, 'content-length') || 0) > limit) fail('payloadTooLarge', 413)
		const chunks = []
		let size = 0
		for await (const chunk of event.node.req) {
			size += chunk.length
			if (size > limit) fail('payloadTooLarge', 413)
			chunks.push(chunk)
		}
		event.node.req.rawBody = Buffer.concat(chunks)
	}
})
