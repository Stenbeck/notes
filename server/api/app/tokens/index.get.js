import { ownerHandler } from '../../../utils/ownerHandler.js'
import { listTokens } from '../../../services/tokens.js'
export default ownerHandler((event, db) => listTokens(db))
