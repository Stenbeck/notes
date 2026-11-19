import { apiHandler } from './responseHandler.js'
import { database } from '../services/database.js'
import { rateLimit } from '../services/rateLimit.js'

export const publicHandler = (action) =>
	apiHandler(async (event) => {
		rateLimit('public', getRequestIP(event))
		const db = await database()
		return action(event, db)
	})
