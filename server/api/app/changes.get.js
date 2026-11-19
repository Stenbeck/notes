import { ownerHandler } from '../../utils/ownerHandler.js'
import { changeSummary } from '../../services/operations.js'

export default ownerHandler((event, db) => changeSummary(db))
