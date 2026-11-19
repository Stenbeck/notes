import { ownerHandler } from '../../../utils/ownerHandler.js'
import { listAttachments } from '../../../services/attachments.js'
export default ownerHandler((event, db, actor) => listAttachments(db, actor))
