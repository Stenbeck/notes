import { setupHandler } from '../../utils/setupHandler.js'
import { setupStatus } from '../../services/setup.js'

export default setupHandler((event, db) => setupStatus(db))
