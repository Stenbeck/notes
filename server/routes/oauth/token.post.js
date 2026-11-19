import { oauthHandler, oauthBody } from '../../utils/oauthHandler.js'
import { exchangeOAuthToken } from '../../services/oauth.js'
export default oauthHandler(async (event, db) => exchangeOAuthToken(db, await oauthBody(event)))
