import { ownerHandler } from '../../../utils/ownerHandler.js'
import { jsonBody } from '../../../utils/responseHandler.js'
import { approveOAuth } from '../../../services/oauth.js'
import { rateLimit } from '../../../services/rateLimit.js'
export default ownerHandler(async (event, db, actor) => {
	rateLimit('auth', actor.user.id)
	const body = await jsonBody(event)
	return approveOAuth(db, body.request || {}, body.tokenId, body.approved)
})
