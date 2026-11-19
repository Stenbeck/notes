import { ownerHandler } from '../../utils/ownerHandler.js'
import { previewImport, importArchive } from '../../services/portability.js'
import { runImportJob } from '../../services/importJobs.js'
import { fail } from '../../utils/publicError.js'
export default ownerHandler(async (event, db) => {
	const data = await readMultipartFormData(event)
	const bytes = data?.find((part) => part.filename)?.data
	if (!bytes) fail('invalidInput')
	const { preview } = getQuery(event)
	const jobId = getHeader(event, 'x-notes-import-job')
	if (preview === 'true') return previewImport(bytes)
	return jobId === undefined ? importArchive(db, bytes, { includeIds: true }) : runImportJob(db, jobId, bytes)
})
