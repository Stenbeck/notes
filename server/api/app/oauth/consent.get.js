import { ownerHandler } from '../../../utils/ownerHandler.js'
import { oauthConsent } from '../../../services/oauth.js'
export default ownerHandler((event, db) => oauthConsent(db, getQuery(event)))
