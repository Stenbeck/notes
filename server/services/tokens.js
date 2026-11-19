import { models } from '../models/index.js'
import { randomBytes, randomUUID } from 'node:crypto'
import { digest } from '../utils/crypto.js'
import { readWorkspace } from './workspace.js'
import { fail } from '../utils/publicError.js'
const validateProjects = (ws, type, projects) => {
	if (!Array.isArray(projects) || projects.some(id => typeof id !== 'string' || ws.nodes[id]?.kind !== 'project'))
		fail('invalidInput')
	if (projects.some(id => ws.nodes[id].status !== 'active' || !ws.nodes[id][`${type}Enabled`]))
		fail('forbidden', 403)
}
export const issueToken = async (db, values) => {
	if (
		!['api', 'mcp'].includes(values.type) ||
		!['read', 'write'].includes(values.permission) ||
		!Array.isArray(values.projects) ||
		!values.projects.length
	)
		fail('invalidInput')
	const ws = await readWorkspace(db)
	if (values.type === 'api' && !ws.settings.apiEnabled) fail('apiDisabled', 403)
	if (values.type === 'mcp' && !ws.settings.mcpEnabled) fail('mcpDisabled', 403)
	validateProjects(ws, values.type, values.projects)
	const token = `notes_${randomBytes(32).toString('hex')}`
	const row = {
		_id: randomUUID(),
		name: String(values.name || 'Integration').slice(0, 100),
		type: values.type,
		projects: values.projects,
		permission: values.permission,
		hash: digest(token)
	}
	await models(db).Token.create(row)
	return { id: row._id, token }
}
export const authorizeToken = async (db, token, type) => {
	if (!token || token.length > 200) fail('unauthorized', 401)
	const row = await models(db)
		.Token.findOne({ hash: digest(token), type, revoked: { $ne: true } })
		.lean()
	return authorizeTokenRow(db, row, type)
}
export const authorizeTokenRow = async (db, row, type) => {
	if (!row || row.revoked || row.type !== type) fail('unauthorized', 401)
	const ws = await readWorkspace(db)
	if (type === 'api' && !ws.settings.apiEnabled) fail('apiDisabled', 403)
	if (type === 'mcp' && !ws.settings.mcpEnabled) fail('mcpDisabled', 403)
	return {
		type,
		projects: row.projects.filter(
			(id) =>
				ws.nodes[id]?.kind === 'project' &&
				ws.nodes[id].status === 'active' &&
				(type === 'mcp' ? ws.nodes[id].mcpEnabled : ws.nodes[id].apiEnabled)
		),
		permission: row.permission
	}
}

export const listTokens = (db) => models(db).Token.find({ revoked: { $ne: true } }, { hash: 0 }).lean()
export const updateTokenProjects = async (db, id, values) => {
	if (Object.keys(values).length !== 1 || !Array.isArray(values.projects)) fail('invalidInput')
	const tokens = models(db).Token
	const filter = { _id: id, revoked: { $ne: true } }
	const token = await tokens.findOne(filter).lean()
	if (!token) fail('notFound', 404)
	validateProjects(await readWorkspace(db), token.type, values.projects)
	const projects = [...new Set(values.projects)]
	const updated = await tokens.findOneAndUpdate(filter, { $set: { projects } }, {
		returnDocument: 'after', projection: { hash: 0 }, runValidators: true
	}).lean()
	if (!updated) fail('notFound', 404)
	return updated
}
export const revokeToken = async (db, id) => {
	await models(db).Token.updateOne({ _id: id }, { $set: { revoked: true } }, { runValidators: true })
	return { revoked: true }
}
export const tokenType = async (db, token) => {
	const row = await models(db)
		.Token.findOne({ hash: digest(token), revoked: { $ne: true } })
		.lean()
	if (!row) fail('unauthorized', 401)
	return row.type
}
