import { rawHandler } from '../../utils/responseHandler.js'
import { requireOwner } from '../../services/auth.js'
import { database } from '../../services/database.js'
import { readAvatar } from '../../services/avatar.js'

export default rawHandler(async (event) => {
	await requireOwner(event)
	const avatar = await readAvatar(await database())
	setHeader(event, 'Content-Type', avatar.type)
	setHeader(event, 'Cache-Control', 'private, no-store')
	setHeader(event, 'X-Content-Type-Options', 'nosniff')
	return send(event, avatar.bytes)
})
