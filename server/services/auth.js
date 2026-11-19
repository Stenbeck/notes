import { betterAuth } from 'better-auth/minimal'
import { models } from '../models/index.js'
import { database, mongoClient } from './database.js'
import { authConfiguration } from '../config/auth.js'
import { fail } from '../utils/publicError.js'

let authPromise
export const getAuth = async () => {
	if (!authPromise)
		authPromise = (async () => betterAuth(authConfiguration(await database(), await mongoClient())))().catch(
			(error) => {
				authPromise = null
				throw error
			}
		)
	return authPromise
}
export const requireOwner = async (event) => {
	const auth = await getAuth()
	const session = await auth.api.getSession({ headers: new Headers(event.node.req.headers) })
	const db = await database()
	const owner = await models(db).Installation.findOne({ _id: 'owner', complete: true }, { userId: 1 }).lean()
	if (!session?.user || session.user.id !== owner?.userId) fail('unauthorized', 401)
	return { type: 'owner', user: { id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image || null } }
}
