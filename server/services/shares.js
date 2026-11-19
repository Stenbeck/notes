import { createHmac, timingSafeEqual } from 'node:crypto'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { configuration } from '../config/index.js'
import { readWorkspace } from './workspace.js'
import { effectiveShare, descendants } from '../../shared/utils/structure.js'
import { fail } from '../utils/publicError.js'
export const passwordHash = hashPassword
const sign = (value) => createHmac('sha256', configuration().secret).update(value).digest('base64url')
export const cookieName = (id) => `notes_share_${id.replaceAll('-', '')}`
export const unlockShare = async (share, password) => {
	if (
		!share.passwordHash ||
		typeof password !== 'string' ||
		!(await verifyPassword(share.passwordHash, password))
	)
		fail('wrongPassword', 403)
	const body = Buffer.from(
		JSON.stringify({ id: share.id, version: share.version, expires: Date.now() + 3600000 })
	).toString('base64url')
	return `${body}.${sign(body)}`
}
export const shareUnlocked = (share, cookie) => {
	if (!share.passwordHash) return true
	try {
		const [body, signature] = (cookie || '').split('.')
		const expected = Buffer.from(sign(body)),
			actual = Buffer.from(signature || '')
		if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false
		const payload = JSON.parse(Buffer.from(body, 'base64url'))
		return payload.id === share.id && payload.version === share.version && payload.expires > Date.now()
	} catch {
		return false
	}
}
export const resolveShare = async (db, slug, documentId, cookies = {}) => {
	const ws = await readWorkspace(db)
	const root = Object.values(ws.nodes).find((node) => node.share?.slug === slug && node.status === 'active')
	if (!root) fail('notFound', 404)
	const id = documentId || root.id
	if (id !== root.id && !descendants(ws, root.id).includes(id)) fail('notFound', 404)
	const policy = effectiveShare(ws, id)
	if (!policy || policy.id !== root.share.id) fail('notFound', 404)
	if (!shareUnlocked(policy, cookies[cookieName(policy.id)])) return { locked: true, ws, policy }
	return { locked: false, ws, root, node: ws.nodes[id], policy }
}

export const readSharePreview = async (db, slug, documentId) => {
	const { locked, ws, node } = await resolveShare(db, slug, documentId)
	const { theme = 'notes', appearance = 'system' } = ws.preferences || {}
	return { locked, title: locked ? null : node.title, theme, appearance, origin: configuration().baseURL }
}
