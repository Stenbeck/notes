let selectedArchive
export const useImport = () => {
	const { state, request, persistImportTask, finishImport } = useNotes()
	const task = computed(() => state.value.importTask)
	const importing = computed(() => task.value.phase === 'importing')
	const importBusy = computed(() => ['previewing', 'importing', 'syncing'].includes(task.value.phase))
	const chooseImport = async (event) => {
		const file = event.target.files?.[0]
		event.target.value = ''
		if (!file || importBusy.value) return
		if (!['uncertain', 'ready', 'failed'].includes(task.value.phase)) task.value.jobId = null
		selectedArchive = file
		Object.assign(task.value, { phase: 'previewing', fileName: file.name, preview: null, result: null, pendingIds: [], error: '' })
		try {
			const form = new FormData()
			form.append('file', file)
			task.value.preview = await request('import?preview=true', { method: 'POST', body: form })
			task.value.phase = 'ready'
		} catch (error) {
			task.value.phase = 'failed'
			task.value.error = error.code || 'serverError'
		}
	}
	const performImport = async () => {
		if (task.value.phase !== 'ready' || !selectedArchive) return
		task.value.jobId ||= crypto.randomUUID()
		task.value.phase = 'importing'
		task.value.error = ''
		try {
			await persistImportTask()
			const form = new FormData()
			form.append('file', selectedArchive)
			// Import can outlast an ordinary request; never retry this mutation automatically.
			const result = await request('import', { method: 'POST', body: form, timeout: 0, headers: { 'x-notes-import-job': task.value.jobId } })
			selectedArchive = null
			Object.assign(task.value, { phase: 'syncing', preview: null, result, pendingIds: result.documentIds })
			await finishImport(result)
		} catch (error) {
			if (task.value.result) {
				state.value.error = error.code || 'networkError'
			} else {
				task.value.phase = 'uncertain'
				task.value.preview = null
				task.value.error = error.code === 'importArchiveMismatch' ? error.code : 'importUncertain'
			}
			await persistImportTask().catch(() => {})
		}
	}
	const checkImport = async () => {
		if (task.value.phase !== 'uncertain' || !task.value.jobId) return
		const jobId = task.value.jobId
		try {
			const status = await request(`import?jobId=${encodeURIComponent(jobId)}`)
			if (task.value.jobId !== jobId || task.value.phase !== 'uncertain') return
			if (status.status === 'complete') await finishImport(status.result)
			else task.value.error = status.status === 'running' ? 'importStillRunning' : 'importReselect'
		} catch {
			if (task.value.jobId === jobId && task.value.phase === 'uncertain') task.value.error = 'importUncertain'
		}
	}
	const clearImport = async () => {
		selectedArchive = null
		Object.assign(task.value, { phase: 'idle', fileName: '', jobId: null, preview: null, result: null, pendingIds: [], error: '' })
		await persistImportTask()
	}
	return { checkImport, clearImport, importTask: task, importing, importBusy, chooseImport, performImport }
}
