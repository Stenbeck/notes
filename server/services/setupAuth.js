import { APIError, createAuthEndpoint } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import { z } from 'zod'
import { verifySetup } from './setup.js'
import { rateLimit } from './rateLimit.js'
import { successResponse } from '../utils/responseHandler.js'

export const setupAuthPlugin = (db) => ({
	id: 'notes-setup',
	endpoints: {
		verifyNotesSetup: createAuthEndpoint('/notes/verify-setup', {
			method: 'POST',
			body: z.object({ token: z.string().min(1).max(200) }),
			requireHeaders: true
		}, async (ctx) => {
			try {
				rateLimit('setup', 'verification')
				const { userId } = await verifySetup(db, ctx.body.token)
				const user = await ctx.context.internalAdapter.findUserById(userId)
				if (!user) throw new APIError('INTERNAL_SERVER_ERROR', { code: 'serverError', message: 'serverError' })
				const session = await ctx.context.internalAdapter.createSession(userId)
				if (!session) throw new APIError('INTERNAL_SERVER_ERROR', { code: 'serverError', message: 'serverError' })
				await setSessionCookie(ctx, { session, user })
				return ctx.json(successResponse({ verified: true, signedIn: true }))
			} catch (error) {
				if (error.publicCode) throw new APIError(error.statusCode, { code: error.publicCode, message: error.publicCode })
				throw error
			}
		})
	}
})
