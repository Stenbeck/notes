import { apiHandler } from './responseHandler.js'
import { requireOwner } from '../services/auth.js'
import { database } from '../services/database.js'

export const ownerHandler = (action) =>
	apiHandler(async (event) => {
		const actor = await requireOwner(event)
		return action(event, await database(), actor)
	})
