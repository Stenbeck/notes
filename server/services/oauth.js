import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { models } from '../models/index.js'
import { configuration } from '../config/index.js'
import { digest } from '../utils/crypto.js'
import { fail } from '../utils/publicError.js'
import { authorizeToken, authorizeTokenRow } from './tokens.js'
import { readWorkspace } from './workspace.js'

export const mcpResource = () => `${configuration().baseURL}/mcp`
const secret = () => randomBytes(32).toString('base64url')
const oauthFail = (code, status = 400) => fail(code, status)
const string = (value, max = 2048) => typeof value === 'string' && value.length > 0 && value.length <= max
export const protectedMetadata = () => ({
	resource: mcpResource(),
	authorization_servers: [configuration().baseURL],
	scopes_supported: ['notes'],
	bearer_methods_supported: ['header']
})
export const authorizationMetadata = () => ({
	issuer: configuration().baseURL,
	authorization_endpoint: `${configuration().baseURL}/oauth/authorize`,
	token_endpoint: `${configuration().baseURL}/oauth/token`,
	registration_endpoint: `${configuration().baseURL}/oauth/register`,
	response_types_supported: ['code'],
	grant_types_supported: ['authorization_code', 'refresh_token'],
	token_endpoint_auth_methods_supported: ['none'],
	code_challenge_methods_supported: ['S256'],
	scopes_supported: ['notes'],
	authorization_response_iss_parameter_supported: true
})
const enabled = async db => {
	const ws = await readWorkspace(db)
	if (!ws.settings.mcpEnabled) oauthFail('access_denied', 403)
	return ws
}
const validRedirect = value => {
	if (!string(value)) return false
	try {
		const url = new URL(value)
		return !url.username && !url.password && !url.hash &&
			(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
	} catch { return false }
}
export const registerOAuthClient = async (db, values) => {
	await enabled(db)
	if (!Array.isArray(values.redirect_uris) || !values.redirect_uris.length || values.redirect_uris.length > 5 ||
		!values.redirect_uris.every(validRedirect)) oauthFail('invalid_redirect_uri')
	if (values.token_endpoint_auth_method && values.token_endpoint_auth_method !== 'none') oauthFail('invalid_client_metadata')
	if (values.grant_types && (!Array.isArray(values.grant_types) || values.grant_types.some(type => !['authorization_code', 'refresh_token'].includes(type)))) oauthFail('invalid_client_metadata')
	if (values.response_types && (!Array.isArray(values.response_types) || values.response_types.some(type => type !== 'code'))) oauthFail('invalid_client_metadata')
	const row = await models(db).OAuthClient.create({
		_id: randomUUID(), name: string(values.client_name, 100) ? values.client_name : 'MCP client',
		redirectUris: [...new Set(values.redirect_uris)]
	})
	return { client_id: row._id, client_name: row.name, redirect_uris: row.redirectUris,
		token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }
}
export const validateAuthorization = async (db, values) => {
	if (!string(values.client_id, 100)) oauthFail('invalid_client')
	const client = await models(db).OAuthClient.findById(values.client_id).lean()
	if (!client || !string(values.redirect_uri) || !client.redirectUris.includes(values.redirect_uri)) oauthFail('invalid_client')
	if (values.response_type !== 'code') oauthFail('unsupported_response_type')
	if (values.resource !== mcpResource()) oauthFail('invalid_target')
	if (values.scope && values.scope !== 'notes') oauthFail('invalid_scope')
	if (values.code_challenge_method !== 'S256' || typeof values.code_challenge !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(values.code_challenge)) oauthFail('invalid_request')
	if (values.state !== undefined && !string(values.state, 2048)) oauthFail('invalid_request')
	await enabled(db)
	return client
}
const sourceToken = async (db, tokenId) => {
	if (!string(tokenId, 100)) oauthFail('invalid_grant')
	const row = await models(db).Token.findById(tokenId).lean()
	const actor = await authorizeTokenRow(db, row, 'mcp')
	return { row, actor }
}
export const oauthConsent = async (db, values) => {
	const client = await validateAuthorization(db, values)
	const ws = await readWorkspace(db)
	const tokens = await models(db).Token.find({ type: 'mcp', revoked: { $ne: true } }, { hash: 0 }).lean()
	return {
		client: { name: client.name, redirectUri: values.redirect_uri },
		tokens: tokens.map(row => ({ id: row._id, name: row.name, permission: row.permission,
			projects: row.projects.filter(id => ws.nodes[id]?.status === 'active' && ws.nodes[id]?.mcpEnabled)
				.map(id => ({ id, title: ws.nodes[id].title })) })).filter(row => row.projects.length)
	}
}
export const approveOAuth = async (db, values, tokenId, approved) => {
	await validateAuthorization(db, values)
	const redirect = new URL(values.redirect_uri)
	if (values.state) redirect.searchParams.set('state', values.state)
	redirect.searchParams.set('iss', configuration().baseURL)
	if (approved !== true) {
		redirect.searchParams.set('error', 'access_denied')
		return { redirect: redirect.href }
	}
	const { actor } = await sourceToken(db, tokenId)
	if (!actor.projects.length) oauthFail('access_denied', 403)
	const code = secret()
	await models(db).OAuthCode.create({ _id: digest(code), clientId: values.client_id,
		redirectUri: values.redirect_uri, challenge: values.code_challenge, resource: mcpResource(), tokenId,
		expiresAt: new Date(Date.now() + 5 * 60 * 1000) })
	redirect.searchParams.set('code', code)
	return { redirect: redirect.href }
}
export const exchangeOAuthToken = async (db, values) => {
	if (!string(values.client_id, 100) || !await models(db).OAuthClient.exists({ _id: values.client_id })) oauthFail('invalid_client', 401)
	if (values.resource !== mcpResource()) oauthFail('invalid_target')
	if (values.scope && values.scope !== 'notes') oauthFail('invalid_scope')
	const now = new Date()
	const access = `notes_oauth_${secret()}`
	const refresh = secret()
	const updates = { accessHash: digest(access), accessExpiresAt: new Date(+now + 60 * 60 * 1000), refreshHash: digest(refresh) }
	if (values.grant_type === 'authorization_code') {
		if (!string(values.redirect_uri) || !string(values.code, 100) || typeof values.code_verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(values.code_verifier)) oauthFail('invalid_grant')
		const challenge = createHash('sha256').update(values.code_verifier).digest('base64url')
		const query = { _id: digest(values.code), clientId: values.client_id, redirectUri: values.redirect_uri,
			resource: mcpResource(), challenge, expiresAt: { $gt: now } }
		// Atomically consume a bound code so simultaneous exchanges cannot replay it.
		const code = await models(db).OAuthCode.findOneAndDelete(query).lean()
		if (!code) oauthFail('invalid_grant')
		await sourceToken(db, code.tokenId)
		await models(db).OAuthGrant.create({ _id: randomUUID(), clientId: code.clientId, resource: code.resource,
			tokenId: code.tokenId, ...updates, expiresAt: new Date(+now + 30 * 24 * 60 * 60 * 1000) })
	} else if (values.grant_type === 'refresh_token') {
		if (!string(values.refresh_token, 100)) oauthFail('invalid_grant')
		const query = { refreshHash: digest(values.refresh_token), clientId: values.client_id,
			resource: mcpResource(), expiresAt: { $gt: now } }
		const grant = await models(db).OAuthGrant.findOne(query).lean()
		if (!grant) oauthFail('invalid_grant')
		await sourceToken(db, grant.tokenId)
		if (!(await models(db).OAuthGrant.updateOne(query, { $set: updates })).modifiedCount) oauthFail('invalid_grant')
	} else oauthFail('unsupported_grant_type')
	return { access_token: access, token_type: 'Bearer', expires_in: 3600, refresh_token: refresh, scope: 'notes' }
}
export const authorizeMcp = async (db, token) => {
	if (typeof token !== 'string' || token.length > 200) fail('unauthorized', 401)
	if (!token.startsWith('notes_oauth_')) return authorizeToken(db, token, 'mcp')
	const now = new Date()
	const grant = await models(db).OAuthGrant.findOne({ accessHash: digest(token), resource: mcpResource(),
		accessExpiresAt: { $gt: now }, expiresAt: { $gt: now } }).lean()
	if (!grant) fail('unauthorized', 401)
	return (await sourceToken(db, grant.tokenId)).actor
}
