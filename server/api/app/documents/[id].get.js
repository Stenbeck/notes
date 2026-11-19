import { ownerHandler } from '../../../utils/ownerHandler.js'
import { readDocument } from '../../../services/operations.js'
export default ownerHandler((event, db, actor) => readDocument(db, event.context.params.id, actor))
