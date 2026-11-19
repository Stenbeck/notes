import { ownerHandler } from '../../../utils/ownerHandler.js'
import { jsonBody } from '../../../utils/responseHandler.js'
import { updateDocument } from '../../../services/operations.js'
export default ownerHandler(async (event, db, actor) =>
	updateDocument(db, event.context.params.id, await jsonBody(event), actor)
)
