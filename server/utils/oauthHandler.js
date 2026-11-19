import { rawHandler, jsonBody } from './responseHandler.js'
import { database } from '../services/database.js'
import { rateLimit } from '../services/rateLimit.js'
import { fail } from './publicError.js'

export const oauthHandler = action => rawHandler(async event => {
	setHeader(event, 'Cache-Control', 'no-store')
	setHeader(event, 'Pragma', 'no-cache')
	rateLimit('auth', getRequestIP(event) || 'oauth')
	try {
		return await action(event, await database())
	} catch (error) {
		if (!error.publicCode) throw error
		setResponseStatus(event, error.statusCode)
		const code = ['unauthorized', 'mcpDisabled', 'forbidden'].includes(error.publicCode) ? 'invalid_grant' : error.publicCode
		return { error: code }
	}
})
export const oauthBody = async event => {
	const type = (getHeader(event, 'content-type') || '').split(';')[0]
	if (type === 'application/json') return jsonBody(event)
	if (type !== 'application/x-www-form-urlencoded') fail('invalid_request')
	const params = new URLSearchParams(await readRawBody(event))
	const values = {}
	for (const [key, value] of params) {
		if (Object.hasOwn(values, key)) fail('invalid_request')
		values[key] = value
	}
	return values
}
