import { getAuth } from '../../services/auth.js'
import { rawHandler } from '../../utils/responseHandler.js'

export default rawHandler(async (event) => (await getAuth()).handler(toWebRequest(event)))
