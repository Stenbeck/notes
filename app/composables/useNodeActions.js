import { descendants } from '../../shared/utils/structure.js'

export const useNodeActions = () => {
	const { state, operation, select, openDocument, effectiveShare, request } = useNotes()
	const { ask } = useConfirmation()
	const { t } = useI18n()
	const assertCurrent = (revision) => {
		if (state.value.workspace.revision !== revision) throw Object.assign(new Error('structureConflict'), { code: 'structureConflict' })
	}
	const nodeAction = async (type, id) => {
		const target = state.value.workspace.nodes[id]
		if (!target) return false
		const revision = state.value.workspace.revision
		const branch = [id, ...descendants(state.value.workspace, id)]
		if (type === 'trash' || type === 'purge') {
			const message = t(type === 'purge' ? 'confirmPurgeNamed' : target.kind === 'project' ? 'confirmTrashProject' : 'confirmTrashDocument', { name: target.title, count: branch.length - 1 })
			if (!await ask(message, { title: t(type === 'purge' ? 'deleteForever' : 'trash'), label: t(type === 'purge' ? 'deleteForever' : 'moveToTrash'), danger: true })) return false
			assertCurrent(revision)
		}
		const share = type === 'restore' && effectiveShare(state.value.workspace, target.parentId)
		if (share && !await ask(t('confirmPublic'))) return false
		await operation({ type, id, confirmPublic: !!share })
		if (['trash', 'purge'].includes(type) && branch.includes(state.value.selected)) {
			const parent = state.value.workspace.nodes[target.parentId]
			if (parent?.status === 'active' && parent.kind === 'document') await openDocument(parent.id)
			else if (parent?.status === 'active') select('project', parent.id)
			else select(target.kind === 'project' ? 'start' : 'inbox')
		}
		return true
	}
	const emptyTrash = async () => {
		const revision = state.value.workspace.revision
		const ids = Object.values(state.value.workspace.nodes).filter((node) => node.status === 'trash').map((node) => node.id)
		if (!ids.length) return false
		if (!await ask(t('confirmEmptyTrash', { count: ids.length }), { title: t('emptyTrash'), label: t('emptyTrash'), danger: true })) return false
		assertCurrent(revision)
		await operation({ type: 'trash.empty', ids })
		select('trash')
		return true
	}
	const cleanTrash = async () => {
		if (!await ask(t('confirmCleanTrash'), { title: t('cleanTrash'), label: t('cleanTrash'), danger: true })) return null
		return request('trash/cleanup', { method: 'POST', timeout: 60000 })
	}
	return { nodeAction, emptyTrash, cleanTrash }
}
