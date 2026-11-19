import { ownerHandler } from '../../../utils/ownerHandler.js'
import { jsonBody } from '../../../utils/responseHandler.js'
import { updateTokenProjects } from '../../../services/tokens.js'

export default ownerHandler(async (event, db) => updateTokenProjects(db, event.context.params.id, await jsonBody(event)))
