import { APIError } from 'better-auth/api'
import { models } from '../models/index.js'

export const ownerPasskeyCredentials = async (db, adapter) => {
	const owner = await models(db).Installation.findOne({ _id: 'owner', complete: true }, { userId: 1 }).lean()
	if (!owner) return []
	const keys = await adapter.findMany({ model: 'passkey', where: [{ field: 'userId', value: owner.userId }], select: ['credentialID', 'transports'] })
	return keys.map(key => ({
		id: key.credentialID,
		type: 'public-key',
		...(key.transports ? { transports: key.transports.split(',').filter(Boolean) } : {})
	}))
}

export const ownerPasskeyOptions = async (db, ctx) => {
	const returned = ctx.context.returned
	if (ctx.path !== '/passkey/generate-authenticate-options' || !returned?.challenge || returned instanceof APIError) return
	// Scope discoverable selection to Notes, including when other apps use localhost.
	const allowCredentials = await ownerPasskeyCredentials(db, ctx.context.adapter)
	if (!allowCredentials.length) throw new APIError('BAD_REQUEST', { code: 'NO_PASSKEYS_REGISTERED', message: 'No passkeys registered' })
	return ctx.json({ ...returned, allowCredentials })
}

export const verifyOwnerPasskey = async (db, { ctx, clientData }) => {
	const credentials = await ownerPasskeyCredentials(db, ctx.context.adapter)
	if (!credentials.some(credential => credential.id === clientData.id)) throw new APIError('UNAUTHORIZED', { code: 'PASSKEY_NOT_FOUND', message: 'Passkey not found' })
}
