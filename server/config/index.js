import { resolve } from 'node:path'
import { fail } from '../utils/publicError.js'

export const configuration = () => {
	const baseURL = process.env.BASE_URL || 'http://localhost:3000'
	const address = new URL(baseURL)
	if (!['http:', 'https:'].includes(address.protocol) || address.pathname !== '/') fail('configuration', 503)
	if (
		process.env.NODE_ENV === 'production' &&
		address.protocol !== 'https:' &&
		!['localhost', '127.0.0.1', '[::1]'].includes(address.hostname)
	)
		fail('httpsRequired', 503)
	const maxFileSizeMB = Number(process.env.MAX_FILE_SIZE_MB || 10)
	const maxFileSize = Math.floor(maxFileSizeMB * 1024 * 1024)
	if (!Number.isFinite(maxFileSizeMB) || maxFileSize < 1 || !Number.isSafeInteger(maxFileSize))
		fail('configuration', 503)
	return {
		baseURL: address.origin,
		maxFileSize,
		secret: process.env.AUTH_SECRET || '',
		dataDir: resolve(process.env.NOTES_DATA_DIR || './data'),
		maintenance: process.env.NOTES_MAINTENANCE === 'true'
	}
}
