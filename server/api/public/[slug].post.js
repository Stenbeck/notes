import { publicHandler } from '../../utils/publicHandler.js'
import { jsonBody } from '../../utils/responseHandler.js'
import { rateLimit } from '../../services/rateLimit.js'
import { unlockPublicDocument } from '../../services/public.js'

export default publicHandler(async (event, db) => {
	rateLimit('password', getRequestIP(event))
	const cookie = await unlockPublicDocument(
		db,
		event.context.params.slug,
		(await jsonBody(event)).password,
		parseCookies(event)
	)
	setCookie(event, cookie.name, cookie.value, cookie.options)
	return { unlocked: true }
})
