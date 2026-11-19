import { ownerHandler } from '../../../utils/ownerHandler.js'
import { jsonBody } from '../../../utils/responseHandler.js'
import { issueToken } from '../../../services/tokens.js'
export default ownerHandler(async (event, db) => issueToken(db, await jsonBody(event)))
