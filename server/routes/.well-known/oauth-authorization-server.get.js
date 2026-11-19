import { authorizationMetadata } from '../../services/oauth.js'
import { rawHandler } from '../../utils/responseHandler.js'
export default rawHandler(() => authorizationMetadata())
