import { mongodbAdapter } from '@better-auth/mongo-adapter'
import { passkey } from '@better-auth/passkey'
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api'
import { magicLink } from 'better-auth/plugins/magic-link'
import { setupAuthPlugin } from '../services/setupAuth.js'
import { models } from '../models/index.js'
import { configuration } from './index.js'
import { rateLimits } from './rateLimits.js'
import { sendMail } from '../services/mail.js'
import { fail } from '../utils/publicError.js'
import { ownerPasskeyOptions, verifyOwnerPasskey } from '../services/passkeyPolicy.js'

export const authConfiguration = (db, client) => {
	const config = configuration()
	if (config.secret.length < 32 || config.secret.startsWith('REPLACE')) fail('authConfiguration', 503)
	return {
		appName: 'Notes',
		baseURL: config.baseURL,
		secret: config.secret,
		database: mongodbAdapter(db, { client, transaction: false }),
		trustedOrigins: [config.baseURL],
		emailAndPassword: { enabled: false },
		user: {
			changeEmail: {
				enabled: true,
				sendChangeEmailConfirmation: async ({ user, url }) => sendMail({
					to: user.email,
					subject: 'Notes: confirm your email change',
					text: `Confirm your email change:\n${url}\n\nAfter confirming, you will receive a verification link at your new email address.`
				})
			}
		},
		emailVerification: {
			expiresIn: 1800,
			sendVerificationEmail: async ({ user, url }) => sendMail({
				to: user.email,
				subject: 'Notes: verify your email',
				text: `Verify your new email address:\n${url}\n\nThis link expires in 30 minutes.`
			})
		},
		hooks: {
			before: createAuthMiddleware(async (ctx) => {
				const publicPasskey = ['/passkey/generate-authenticate-options', '/passkey/verify-authentication']
				if (!['/update-user', '/change-email'].includes(ctx.path) && (!ctx.path.startsWith('/passkey/') || publicPasskey.includes(ctx.path))) return
				const session = await getSessionFromCtx(ctx)
				const owner = await models(db).Installation.findOne({ _id: 'owner', complete: true }, { userId: 1, email: 1 }).lean()
				if (!session?.user || session.user.id !== owner?.userId) throw new APIError('UNAUTHORIZED', { code: 'unauthorized', message: 'unauthorized' })
			}),
			after: createAuthMiddleware((ctx) => ownerPasskeyOptions(db, ctx))
		},
		session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
		advanced: {
			cookiePrefix: 'notes',
			useSecureCookies: config.baseURL.startsWith('https:'),
			defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' }
		},
		rateLimit: { enabled: true, storage: 'memory', ...rateLimits.auth },
		logger: { disabled: true },
		databaseHooks: {
			user: {
				update: {
					before: async (data) => {
						if (data.name !== undefined && (typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 100)) fail('invalidInput')
						return { data: { ...data, ...(data.name !== undefined ? { name: data.name.trim() } : {}) } }
					},
					after: async (user) => {
						await models(db).Installation.updateOne({ _id: 'owner', userId: user.id }, { $set: { name: user.name, email: user.email } }, { runValidators: true })
					}
				},
				create: {
					before: async () => {
						fail('registrationClosed', 403)
					}
				}
			}
		},
		plugins: [
			setupAuthPlugin(db),
			passkey({ rpID: new URL(config.baseURL).hostname, rpName: 'Notes', origin: config.baseURL,
				advanced: { webAuthnChallengeCookie: 'passkey-challenge' },
				authentication: { afterVerification: (args) => verifyOwnerPasskey(db, args) }
			}),
			magicLink({
				disableSignUp: true,
				expiresIn: 600,
				storeToken: 'hashed',
				sendMagicLink: async ({ email, url }) => {
					const owner = await models(db).Installation.findOne({ _id: 'owner', complete: true }, { userId: 1, email: 1 }).lean()
					if (owner?.email !== email.toLowerCase()) return
					await sendMail({
						to: email,
						subject: 'Notes: sign in',
						text: `Sign in to Notes:\n${url}\n\nThis link expires in 10 minutes.`
					})
				}
			})
		]
	}
}
