import { rawHandler } from '../utils/responseHandler.js'
import { configuration } from '../config/index.js'
import { database } from '../services/database.js'
import { authorizeMcp, mcpResource } from '../services/oauth.js'
import { notesMcpHandler } from '../services/mcp.js'
import { rateLimit } from '../services/rateLimit.js'

export default rawHandler(async event => {
	setHeader(event, 'Cache-Control', 'private, no-store')
	const token = (getHeader(event, 'authorization') || '').match(/^Bearer ([^\s]+)$/i)?.[1] || ''
	const db = await database()
	try {
		await authorizeMcp(db, token)
	} catch (error) {
		if (error.statusCode === 401) setHeader(event, 'WWW-Authenticate', `Bearer resource_metadata="${configuration().baseURL}/.well-known/oauth-protected-resource/mcp", scope="notes"`)
		throw error
	}
	rateLimit('mcp', token)
	const handler = notesMcpHandler(db, token)
	try {
		const request = new Request(mcpResource(), {
			method: event.method,
			headers: getRequestHeaders(event),
			...(['GET', 'HEAD'].includes(event.method) ? {} : { body: await readRawBody(event) })
		})
		const response = await handler.fetch(request)
		// All Notes tools complete within a request; no persistent session or subscription is exposed.
		const body = await response.text()
		setResponseStatus(event, response.status)
		for (const [key, value] of response.headers) setHeader(event, key, value)
		return body
	} finally {
		await handler.close()
	}
})
