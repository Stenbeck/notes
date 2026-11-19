import { apiHandler, jsonBody } from './responseHandler.js'
import { database } from '../services/database.js'
import { authorizeToken } from '../services/tokens.js'
import { rateLimit } from '../services/rateLimit.js'
import { integrationCall } from '../services/integrations.js'

export const integrationHandler = (type, action) =>
	apiHandler(async (event) => {
		const token = (getHeader(event, 'authorization') || '').replace(/^Bearer /, '')
		const db = await database()
		const actor = await authorizeToken(db, token, type)
		rateLimit(type, token)
		const values = event.method === 'GET' ? getQuery(event) : await jsonBody(event)
		const data = await integrationCall(db, actor, action, values)
		if (type !== 'api' || !Array.isArray(data)) return data
		const offset = Math.max(0, Number(values.offset) || 0)
		const limit = Math.min(100, Math.max(1, Number(values.limit) || 50))
		return {
			items: data.slice(offset, offset + limit),
			nextOffset: offset + limit < data.length ? offset + limit : null
		}
	})
