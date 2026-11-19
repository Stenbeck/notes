import { rawHandler } from '../../utils/responseHandler.js'
import { requireOwner } from '../../services/auth.js'
import { database } from '../../services/database.js'
import { exportArchive } from '../../services/portability.js'

export default rawHandler(async (event) => {
	await requireOwner(event)
	const bytes = await exportArchive(await database(), getQuery(event))
	setHeader(event, 'Content-Type', 'application/zip')
	setHeader(event, 'Content-Disposition', 'attachment; filename="notes-export.zip"')
	return bytes
})
