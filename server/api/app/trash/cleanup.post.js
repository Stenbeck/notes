import { cleanupOrphans } from '../../../services/cleanup.js'
import { ownerHandler } from '../../../utils/ownerHandler.js'

export default ownerHandler((_, db) => cleanupOrphans(db))
