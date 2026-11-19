import { ownerHandler } from '../../utils/ownerHandler.js'
import { uploadAttachment } from '../../services/operations.js'
export default ownerHandler(async (event, db, actor) => {
	const data = await readMultipartFormData(event)
	return uploadAttachment(
		db,
		String(getQuery(event).documentId || ''),
		data?.find((part) => part.filename),
		actor,
		getQuery(event).uploadId ? String(getQuery(event).uploadId) : undefined
	)
})
