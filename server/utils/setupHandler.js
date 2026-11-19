import { apiHandler } from './responseHandler.js'
import { database } from '../services/database.js'
import { rateLimit } from '../services/rateLimit.js'

export const setupHandler = (action) =>
	apiHandler(async (event) => {
		const db = await database()
		rateLimit('setup', getRequestIP(event))
		return action(event, db)
	})
