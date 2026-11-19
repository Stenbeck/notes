import { ownerHandler } from '../../../utils/ownerHandler.js'
import { revokeToken } from '../../../services/tokens.js'
export default ownerHandler((event, db) => revokeToken(db, event.context.params.id))
