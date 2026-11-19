import { oauthHandler } from '../../utils/oauthHandler.js'
import { jsonBody } from '../../utils/responseHandler.js'
import { registerOAuthClient } from '../../services/oauth.js'
import { rateLimit } from '../../services/rateLimit.js'
export default oauthHandler(async (event, db) => {
	rateLimit('setup', 'oauth-registration')
	const result = await registerOAuthClient(db, await jsonBody(event))
	setResponseStatus(event, 201)
	return result
})
