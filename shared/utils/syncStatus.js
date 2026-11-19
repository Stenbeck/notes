export const getSyncStatus = ({ online = true, sync, error, importPhase }) => {
	if (!online || sync === 'offline') return { status: 'offline', severity: 'warning', title: 'syncOfflineTitle', detail: 'syncOfflineDetail', action: 'sync' }
	if (error === 'sessionExpired' || error === 'unauthorized') return { status: 'error', severity: 'error', title: 'syncSignInTitle', detail: 'syncSignInDetail', action: 'login' }
	if (error === 'structureConflict') return { status: 'error', severity: 'error', title: 'syncChoiceTitle', detail: 'syncChoiceDetail', action: 'resolve' }
	if (error === 'confirmPublic') return { status: 'error', severity: 'error', title: 'syncSharingTitle', detail: 'syncSharingDetail', action: 'resolve' }
	if (['forbidden', 'notFound', 'cycle', 'projectNesting', 'attachmentTooLarge', 'documentTooLarge', 'workspaceTooLarge', 'payloadTooLarge', 'invalidInput', 'documentRemoved', 'documentConflict'].includes(error)) return { status: 'error', severity: 'error', title: 'syncChangeBlockedTitle', detail: `syncBlocked_${error}`, action: 'retry' }
	if (error || sync === 'error') return { status: 'error', severity: 'warning', title: 'syncPausedTitle', detail: error === 'rateLimited' ? 'syncWaitingDetail' : 'syncPausedDetail', action: 'retry' }
	if (importPhase === 'uncertain') return { status: 'error', severity: 'warning', title: 'importPhase_uncertain', detail: 'importUncertain', action: 'sync' }
	if (importPhase === 'importing') return { status: 'syncing', severity: 'neutral', title: 'importPhase_importing', detail: 'importKeepOpen', action: 'sync' }
	if (importPhase === 'syncing') return { status: 'syncing', severity: 'neutral', title: 'importPhase_syncing', detail: 'importSyncDetail', action: 'sync' }
	if (sync === 'synced') return { status: sync, severity: 'success', title: 'syncCompleteTitle', detail: 'syncCompleteDetail', action: 'sync' }
	if (sync === 'local') return { status: sync, severity: 'warning', title: 'syncPendingTitle', detail: 'syncPendingDetail', action: 'sync' }
	if (sync === 'syncing') return { status: sync, severity: 'neutral', title: 'syncProgressTitle', detail: 'syncProgressDetail', action: 'sync' }
	return { status: 'loading', severity: 'neutral', title: 'syncPreparingTitle', detail: 'syncPreparingDetail', action: 'sync' }
}
