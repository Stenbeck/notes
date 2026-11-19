import { ownerHandler } from '../../../utils/ownerHandler.js'
import { deleteAttachment } from '../../../services/attachments.js'
export default ownerHandler((event, db, actor) => deleteAttachment(db, event.context.params.id, actor))
