import { rawHandler } from '../../utils/responseHandler.js'
import { database } from '../../services/database.js'
import { requireOwner } from '../../services/auth.js'
import { readAttachment } from '../../services/attachments.js'

export default rawHandler(async (event) => {
	const { file, bytes } = await readAttachment(await database(), event.context.params.id, {
		slug: getQuery(event).share ? String(getQuery(event).share) : undefined,
		cookies: parseCookies(event),
		bearer: (getHeader(event, 'authorization') || '').replace(/^Bearer /, ''),
		owner: () => requireOwner(event)
	})
	setHeader(event, 'Cache-Control', 'private, no-store')
	setHeader(event, 'Content-Type', file.type)
	setHeader(
		event,
		'Content-Disposition',
		`${file.type.startsWith('image/') && !getQuery(event).download ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`
	)
	return bytes
})
