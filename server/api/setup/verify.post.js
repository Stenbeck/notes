import { rawHandler, jsonBody } from '../../utils/responseHandler.js'
import { getAuth } from '../../services/auth.js'

export default rawHandler(async (event) => (await getAuth()).api.verifyNotesSetup({
	body: await jsonBody(event),
	headers: new Headers(event.node.req.headers),
	asResponse: true
}))
