export const useNotesRequest = () => {
	const app = useNuxtApp()
	const pool = app._notesRequests ||= { controllers: new Set(), reads: new Map(), generation: 0 }
	const request = (path, options = {}) => {
		// Only identical default reads share work; mutations always start their own request.
		const shared = Object.keys(options).length === 0
		if (shared && pool.reads.has(path)) return pool.reads.get(path)
		if (!['GET', 'HEAD'].includes((options.method || 'GET').toUpperCase())) pool.reads.clear()
		const controller = new AbortController()
		const generation = pool.generation
		pool.controllers.add(controller)
		const task = (async () => {
			try {
				const response = await $fetch(`/api/app/${path}`, {
					timeout: 10000,
					retry: false,
					...options,
					signal: controller.signal
				})
				if (generation !== pool.generation) throw Object.assign(new Error('unauthorized'), { code: 'unauthorized' })
				if (!response.success) throw Object.assign(new Error(response.error), { code: response.error })
				return response.data
			} catch (error) {
				error.code = error.data?.error || error.code || 'networkError'
				throw error
			} finally {
				pool.controllers.delete(controller)
			}
		})()
		if (shared) {
			pool.reads.set(path, task)
			const release = () => { if (pool.reads.get(path) === task) pool.reads.delete(path) }
			task.then(release, release)
		}
		return task
	}
	const abortRequests = () => {
		pool.generation++
		pool.reads.clear()
		for (const controller of pool.controllers) controller.abort()
	}
	return { request, abortRequests }
}
