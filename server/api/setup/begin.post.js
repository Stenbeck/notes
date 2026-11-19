import { setupHandler } from '../../utils/setupHandler.js'
import { jsonBody } from '../../utils/responseHandler.js'
import { beginSetup } from '../../services/setup.js'

export default setupHandler(async (event, db) => beginSetup(db, await jsonBody(event)))
