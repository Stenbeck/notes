import { protectedMetadata } from '../../services/oauth.js'
import { rawHandler } from '../../utils/responseHandler.js'
export default rawHandler(() => protectedMetadata())
