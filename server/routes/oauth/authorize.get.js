import { oauthHandler } from '../../utils/oauthHandler.js'
import { validateAuthorization } from '../../services/oauth.js'
export default oauthHandler(async (event, db) => {
	const values = getQuery(event)
	await validateAuthorization(db, values)
	return sendRedirect(event, `/connect?${new URLSearchParams(values)}`)
})
