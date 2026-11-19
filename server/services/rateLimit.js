import { rateLimits } from '../config/rateLimits.js'
import { digest } from '../utils/crypto.js'
import { fail } from '../utils/publicError.js'

export const createRateLimiter = ({ maxEntries = 10000, now = Date.now } = {}) => {
	const counters = new Map()
	let nextCleanup = 0
	return (scope, key) => {
		const time = now()
		if (time >= nextCleanup) {
			for (const [id, row] of counters) if (row.expiresAt <= time) counters.delete(id)
			nextCleanup = time + 1000
		}
		const { window, max } = rateLimits[scope]
		const interval = window * 1000
		const bucket = Math.floor(time / interval)
		const id = `${scope}:${digest(String(key))}:${bucket}`
		let row = counters.get(id)
		if (!row) {
			if (counters.size >= maxEntries) fail('rateLimited', 429)
			row = { count: 0, expiresAt: (bucket + 1) * interval }
			counters.set(id, row)
		}
		if (++row.count > max) fail('rateLimited', 429)
	}
}

export const rateLimit = createRateLimiter()
