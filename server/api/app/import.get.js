import { ownerHandler } from '../../utils/ownerHandler.js'
import { importStatus } from '../../services/importJobs.js'

export default ownerHandler((event, db) => importStatus(db, getQuery(event).jobId))
