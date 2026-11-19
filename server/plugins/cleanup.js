import { database } from '../services/database.js'
import { cleanupOrphans } from '../services/cleanup.js'
import logger from '../utils/logger.js'
export default defineNitroPlugin((nitro) => {
	const timer = setInterval(async () => {
		if (!process.env.MONGODB_URI || process.env.NOTES_MAINTENANCE === 'true') return
		try {
			await cleanupOrphans(await database())
		} catch {
			logger.error('Orphan cleanup failed')
		}
	}, 3600000)
	timer.unref()
	nitro.hooks.hook('close', () => clearInterval(timer))
})
