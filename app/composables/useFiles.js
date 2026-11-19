export const useFiles = () => {
	const files = useState('notes-files', () => [])
	const loaded = useState('notes-files-loaded', () => false)
	const error = useState('notes-files-error', () => '')
	const sequence = useState('notes-files-request', () => 0)
	const { request, state } = useNotes()
	const { t } = useI18n()
	const { ask } = useConfirmation()
	const refreshFiles = async () => {
		const userId = state.value.user?.id
		const current = ++sequence.value
		try {
			const result = await request('files')
			if (current !== sequence.value || state.value.user?.id !== userId) return
			files.value = result
			loaded.value = true
			error.value = ''
		} catch (e) {
			if (current !== sequence.value || state.value.user?.id !== userId) return
			error.value = e.code || 'networkError'
		}
	}
	const findFile = (id) => files.value.find((file) => file.id === id)
	const downloadFile = (id) => {
		const link = document.createElement('a')
		link.href = `/api/files/${encodeURIComponent(id)}?download=1`
		link.download = findFile(id)?.name || ''
		document.body.append(link)
		link.click()
		link.remove()
	}
	const removeFile = async (id, fromDocument = false) => {
		const file = findFile(id)
		if (!file || file.deleted && !file.deletionPending) return false
		const usage = file.references.map((node) => node.title).join(', ')
		if (!await ask(t(fromDocument ? 'deleteFileFromDocumentConfirm' : 'deleteFileConfirm', { name: file.name, documents: usage || t('unusedFile') }), { title: t('deleteFile'), label: t('deleteFile'), danger: true })) return false
		await request(`files/${encodeURIComponent(id)}`, { method: 'DELETE' })
		const current = findFile(id)
		if (current) {
			current.deleted = true
			current.deletionPending = false
		}
		if ('caches' in window) {
			const cache = await caches.open('notes-private-files-v1')
			for (const key of await cache.keys())
				if (new URL(key.url).pathname === `/api/files/${id}`) await cache.delete(key)
		}
		return true
	}
	watch(() => state.value.user, (user) => {
		if (!user) {
			files.value = []
			loaded.value = false
			error.value = ''
		}
	})
	return { files, loaded, error, findFile, refreshFiles, downloadFile, removeFile }
}
