import { ownerHandler } from '../../utils/ownerHandler.js'
import { jsonBody } from '../../utils/responseHandler.js'
import { structureOperation } from '../../services/operations.js'
export default ownerHandler(async (event, db, actor) => structureOperation(db, await jsonBody(event), actor))
