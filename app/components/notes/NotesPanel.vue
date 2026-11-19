<template>
	<component
		:is="panel.type === 'profile' ? profileModal : dropdownPanel"
		:title="projectPickerOpen ? t(editingToken ? 'editTokenProjects' : 'chooseProjects') : panelTitle"
		v-bind="containerProps"
		@close="projectPickerOpen ? closeProjectPicker() : closePanel()">
		<p v-if="error" class="error-message mb-3" role="alert">{{ t(error) }}</p>
		<form id="notes-project" v-if="panel.type === 'project'" class="space-y-2.5" @submit.prevent="saveProject">
			<label class="block">
				{{ t('title') }}
				<input v-model="values.title" required class="mt-1 w-full rounded border border-(--line) bg-(--surface) p-2" />
			</label>
			<label class="block">
				{{ t('description') }}
				<textarea
					v-model="values.description"
					rows="2"
					class="mt-1 w-full rounded border border-(--line) bg-(--surface) p-2" />
			</label>
			<IconPicker v-model="values.icon" :color="values.color" />
			<label class="flex items-center justify-between gap-3 rounded-md border border-(--line) px-3 py-2">
				<span>{{ t('color') }}</span>
				<span class="flex items-center gap-3">
					<span class="font-mono text-(--muted)">{{ values.color }}</span>
					<input
						v-model="values.color"
						type="color"
						class="size-8 cursor-pointer overflow-hidden rounded border-0 bg-transparent p-0" />
				</span>
			</label>
			<p class="text-(--muted)">{{ t('projectIntegrationHelp') }}</p>
			<label class="flex items-center gap-0.5">
				<input v-model="values.apiEnabled" type="checkbox" />
				{{ t('projectApiEnabled') }}
			</label>
			<label class="flex items-center gap-0.5">
				<input v-model="values.mcpEnabled" type="checkbox" />
				{{ t('mcpEnabled') }}
			</label>
		</form>
		<div v-else-if="panel.type === 'actions'" class="flex flex-col gap-0.5">
			<button
				role="menuitem"
				v-if="node?.kind === 'project'"
				class="flex items-center gap-2 rounded px-2 py-1 whitespace-nowrap text-left hover:bg-(--soft)"
				@click="state.panel = { type: 'project', id: node.id }">
				<LucidePencil class="size-4 shrink-0" aria-hidden="true" />{{ t('edit') }}
			</button>
			<button
				role="menuitem"
				class="flex items-center gap-2 rounded px-2 py-1 whitespace-nowrap text-left hover:bg-(--soft)"
				@click="state.panel = { type: 'move', id: panel.id }">
				<LucideFolderInput class="size-4 shrink-0" aria-hidden="true" />{{ t('move') }}
			</button>
			<button
				v-if="node?.kind === 'document'"
				role="menuitem"
				:disabled="saving || printing"
				class="flex items-center gap-2 rounded px-2 py-1 whitespace-nowrap text-left hover:bg-(--soft) disabled:opacity-50"
				@click="printSelected">
				<LucidePrinter class="size-4 shrink-0" aria-hidden="true" />{{ t(printing ? 'preparingPrint' : 'printDocument') }}
			</button>
			<button v-if="node?.kind === 'document'" role="menuitem" :aria-label="copyMarkdownLabel" :disabled="saving || copying"
				class="flex items-center gap-2 rounded px-2 py-1 whitespace-nowrap text-left hover:bg-(--soft) disabled:opacity-50"
				@click="copySelectedMarkdown">
				<LucideCheck v-if="copiedMarkdown" class="size-4 shrink-0" aria-hidden="true" />
				<LucideCopy v-else class="size-4 shrink-0" aria-hidden="true" />
				<span role="status" aria-live="polite">{{ copyMarkdownLabel }}</span>
			</button>
			<a
				role="menuitem"
				class="flex items-center gap-2 whitespace-nowrap rounded px-2 py-1 hover:bg-(--soft)"
				:href="`/api/app/export?id=${panel.id}&format=json`">
				<LucideBraces class="size-4 shrink-0" aria-hidden="true" />{{ t('export') }} JSON
			</a>
			<a
				role="menuitem"
				class="flex items-center gap-2 whitespace-nowrap rounded px-2 py-1 hover:bg-(--soft)"
				:href="`/api/app/export?id=${panel.id}&format=markdown`">
				<LucideFileText class="size-4 shrink-0" aria-hidden="true" />{{ t('export') }} Markdown
			</a>
			<button
				role="menuitem"
				v-if="node?.status !== 'active'"
				class="flex items-center gap-2 rounded px-2 py-1 whitespace-nowrap text-left hover:bg-(--soft)"
				@click="act('restore')">
				<LucideArchiveRestore class="size-4 shrink-0" aria-hidden="true" />{{ t('restore') }}
			</button>
			<button
				role="menuitem"
				v-if="node?.status === 'active'"
				class="flex items-center gap-2 rounded px-2 py-1 whitespace-nowrap text-left hover:bg-(--soft)"
				@click="act('archive')">
				<LucideArchive class="size-4 shrink-0" aria-hidden="true" />{{ t('archive') }}
			</button>
			<button
				role="menuitem"
				v-if="node?.status !== 'trash'"
				class="flex items-center gap-2 rounded px-2 py-1 whitespace-nowrap text-left hover:bg-(--soft)"
				@click="act('trash')">
				<LucideTrash2 class="size-4 shrink-0" aria-hidden="true" />{{ t('trash') }}
			</button>
			<button
				role="menuitem"
				v-else
				class="flex items-center gap-2 rounded px-2 py-1 whitespace-nowrap text-left text-(--status-error) hover:bg-(--danger-soft)"
				@click="purge">
				<LucideTrash2 class="size-4 shrink-0" aria-hidden="true" />{{ t('deleteForever') }}
			</button>
		</div>
		<div v-else-if="panel.type === 'move'" class="space-y-2">
			<p class="text-(--muted)">{{ t(node?.kind === 'project' ? 'chooseMoveBefore' : 'chooseMoveDestination') }}</p>
			<MoveDestinationTree :nodes="moveRoots" :excluded="moveExcluded" :disabled="saving" :projects-only="node?.kind === 'project'"
				v-model="moveDestination" v-model:expanded="moveExpanded" />
		</div>
		<form id="notes-share" v-else-if="panel.type === 'share'" class="space-y-4" @submit.prevent="saveShare">
			<p v-if="inherited" class="text-(--muted)">{{ t('inheritedShare') }}</p>
			<fieldset :disabled="inherited" class="space-y-4">
				<label class="flex items-center gap-2">
					<input v-model="values.enabled" type="checkbox" @change="ensureSlug" />
					{{ t('shared') }}
				</label>
				<div class="space-y-1" :class="{ 'mb-2!': shareURL }">
					<label class="block">
						{{ t('slug') }}
						<input v-model="values.slug" class="mt-1 w-full rounded border border-(--line) bg-(--surface) p-2" />
					</label>
					<div v-if="shareURL" class="flex items-center gap-1">
						<a :href="shareURL" target="_blank" rel="noopener" class="min-w-0 wrap-anywhere text-(--accent)">
							{{ shareURL }}
						</a>
						<div class="relative shrink-0">
							<button type="button" class="inline-flex rounded p-1 hover:bg-(--soft)" :title="shareLinkCopied ? undefined : t('copyShareLink')" :aria-label="t('copyShareLink')" @click="copyShareLink">
								<AppIcon :name="shareLinkCopied ? 'Check' : 'Copy'" />
							</button>
							<span role="status" class="pointer-events-none absolute right-0 bottom-full z-10 mb-1 whitespace-nowrap"
								:class="{ 'rounded border border-(--line) bg-(--surface) px-2 py-1 shadow-md': shareLinkCopied }">
								{{ shareLinkCopied ? t('shareLinkCopied') : '' }}
							</span>
						</div>
					</div>
				</div>
				<label class="block">
					{{ t('optionalPassword') }}
					<input
						v-model="values.password"
						type="password"
						autocomplete="new-password"
						class="mt-1 w-full rounded border border-(--line) bg-(--surface) p-2" />
				</label>
				<p class="text-[14px] text-(--muted)">{{ t('shareHelp') }}</p>
				<label v-if="replacesShares && values.enabled" class="flex items-start gap-2 rounded-md bg-(--paper) p-3">
					<input v-model="values.confirmReplace" required type="checkbox" class="mt-1" />
					<span>{{ t('confirmReplace') }}</span>
				</label>
			</fieldset>
		</form>
		<div v-else-if="panel.type === 'profile'" :class="projectPickerOpen ? 'flex min-h-0 flex-1 flex-col' : undefined">
			<IntegrationProjectPicker
				v-if="projectPickerOpen"
				:projects="projects"
				:allowed-ids="pickerAllowedIds"
				:selection="editingToken?.projects ?? tokenValues.projects"
				:integration="editingToken?.type ?? tokenValues.type"
				:disabled="pickerDisabled"
				:editing-token="editingToken"
				:has-unavailable-selection="editingToken?.projects.some(id => !pickerAllowedIds.has(id))"
				@apply="applyProjectSelection" />
			<div v-show="!projectPickerOpen" class="space-y-5">
				<AccountSettings />
				<SettingsSection :title="t('preferences')">
					<div class="space-y-2">
						<SettingsActionRow v-for="field in preferenceFields" :key="field.key" :title="t(field.label)">
							<AppSelect
								v-model="preferences[field.key]"
								:height="40"
								:disabled="saving"
								class="w-full"
								:label="t(field.label)"
								:options="field.options"
								@change="savePreferences(field.key)" />
						</SettingsActionRow>
					</div>
				</SettingsSection>
				<SettingsSection :title="`${t('import')} / ${t('export')}`" :aria-label="`${t('import')} / ${t('export')}`">
					<SettingsActionRow data-import-row :title="t('importFromOutline')" :description="t('importHelp')">
						<SettingsButton tag="label" class="cursor-pointer">
							<LucideUpload class="size-4" />
							{{ t('chooseArchive') }}
							<input
								type="file"
								accept=".zip"
								:aria-label="t('chooseArchive')"
								class="sr-only"
								:disabled="saving || importBusy"
								@change="chooseImport" />
						</SettingsButton>
					</SettingsActionRow>
					<div
						v-if="importTask.fileName"
						data-import-status
						:data-phase="importTask.phase"
						:aria-busy="['previewing', 'importing', 'syncing'].includes(importTask.phase)"
						class="space-y-2 rounded-md border border-(--line) bg-(--paper) p-3">
						<p class="wrap-break-word font-medium">{{ importTask.fileName }}</p>
						<p v-if="importTask.preview" class="text-(--muted)">
							{{ importTask.preview.documents }} {{ t('documents') }} · {{ importTask.preview.attachments }}
							{{ t('files') }}
						</p>
						<p
							role="status"
							aria-live="polite"
							class="flex items-center gap-2"
							:class="importTask.phase === 'complete' ? 'text-(--status-ok)' : ''">
							<LucideLoaderCircle
								v-if="['previewing', 'importing', 'syncing'].includes(importTask.phase)"
								class="size-4 shrink-0 animate-spin"
								aria-hidden="true" />
							<LucideCheck v-else-if="importTask.phase === 'complete'" class="size-4 shrink-0" aria-hidden="true" />
							<span>{{ t(`importPhase_${importTask.phase}`) }}</span>
						</p>
						<p v-if="importTask.result" class="text-(--muted)">
							{{ t('importCounts', { documents: importTask.result.imported, files: importTask.result.attachments }) }}
						</p>
						<p v-if="importTask.phase === 'importing'" class="text-(--muted)">{{ t('importKeepOpen') }}</p>
						<p v-if="importTask.phase === 'syncing'" class="text-(--muted)">{{ t('importCanClose') }}</p>
						<div v-if="importWarnings.length" class="space-y-1">
							<p class="font-medium">{{ t('importWarnings') }}</p>
							<ul class="list-disc pl-5 text-(--muted)">
								<li v-for="warning in importWarnings" :key="warning">{{ warning }}</li>
							</ul>
						</div>
						<SettingsButton v-if="importTask.phase === 'uncertain' && importTask.jobId" @click="checkImport">
							{{ t('importCheckStatus') }}
						</SettingsButton>
						<SettingsButton v-if="!importBusy && importTask.jobId && !importTask.result" @click="abandonImport">
							{{ t('importClear') }}
						</SettingsButton>
						<p v-if="importTask.error" role="alert" class="error-message">{{ t(importTask.error) }}</p>
						<SettingsButton
							v-if="importTask.preview"
							:disabled="saving || importBusy"
							primary
							:aria-label="t('importConfirm')"
							@click="performImport">
							{{ t('import') }}
						</SettingsButton>
					</div>
					<SettingsActionRow
						data-export-row
						class="border-t border-(--line) pt-4"
						:title="t('export')"
						:description="t('exportHelp')">
						<SettingsButton tag="a" href="/api/app/export?format=json" :aria-label="t('exportJSON')">
							<LucideDownload class="size-4" />
							JSON
						</SettingsButton>
						<SettingsButton tag="a" href="/api/app/export?format=markdown" :aria-label="t('exportMarkdown')">
							<LucideDownload class="size-4" />
							Markdown
						</SettingsButton>
					</SettingsActionRow>
				</SettingsSection>
				<SettingsSection :title="t('integrations')">
					<SettingsActionRow inline control-id="settings-api-enabled" :title="t('apiEnabled')">
						<input
							id="settings-api-enabled"
							v-model="apiEnabled"
							:aria-label="t('apiEnabled')"
							:disabled="saving"
							type="checkbox"
							class="size-4 justify-self-end"
							@change="saveAPI" />
					</SettingsActionRow>
					<SettingsActionRow inline control-id="settings-mcp-enabled" :title="t('globalMcpEnabled')">
						<input
							id="settings-mcp-enabled"
							v-model="mcpEnabled"
							:aria-label="t('globalMcpEnabled')"
							:disabled="saving"
							type="checkbox"
							class="size-4 justify-self-end"
							@change="saveAPI" />
					</SettingsActionRow>
					<div v-if="mcpEnabled" class="space-y-2">
						<label for="settings-mcp-address" class="block text-[14px]">{{ t('mcpAddress') }}</label>
						<input id="settings-mcp-address" :value="mcpAddress" readonly class="w-full rounded border border-(--line) bg-(--surface) p-2 text-[14px] text-(--ink)" @focus="$event.target.select()" />
						<p class="text-[14px] leading-5 text-(--muted)">{{ t('mcpAddressHelp') }}</p>
					</div>
					<p class="text-[14px] leading-5 text-(--muted)">{{ t('integrationHelp') }}</p>
					<p v-if="!integrationOptions.length" class="text-[14px] leading-5 text-(--muted)">
						{{ t('enableIntegrationForTokens') }}
					</p>
					<fieldset
						data-token-form
						:disabled="tokenFormDisabled"
						class="min-w-0 space-y-3 rounded-md border border-(--line) p-3 disabled:opacity-50">
						<label class="block space-y-2">
							<span>{{ t('tokenName') }}</span>
							<SettingsInput v-model="tokenValues.name" :disabled="tokenFormDisabled" :placeholder="t('tokenName')" />
						</label>
						<div class="grid grid-cols-2 gap-3">
							<div class="space-y-2">
								<span>{{ t('integrationType') }}</span>
								<AppSelect
									v-model="tokenValues.type"
									:height="40"
									:label="t('integrationType')"
									:disabled="tokenFormDisabled"
									:options="integrationOptions" />
							</div>
							<div class="space-y-2">
								<span>{{ t('permission') }}</span>
								<AppSelect
									v-model="tokenValues.permission"
									:disabled="tokenFormDisabled"
									:height="40"
									:label="t('permission')"
									:options="[
										{ value: 'read', label: t('read') },
										{ value: 'write', label: t('write') },
									]" />
							</div>
						</div>
						<div data-project-access class="flex items-center justify-between gap-3 border-t border-(--line) pt-3">
							<h3 class="font-medium">{{ t('projectAccess') }}</h3>
							<SettingsButton
								id="integration-projects-trigger"
								ref="projectTrigger"
								compact
								:disabled="tokenFormDisabled"
								aria-haspopup="dialog"
								@click="openProjectPicker()">
								{{ t('chooseProjects') }} · {{ tokenValues.projects.length }}
							</SettingsButton>
						</div>
						<div class="flex justify-end">
							<SettingsButton primary :disabled="!canCreateToken" @click="createToken">
								{{ t('newToken') }}
							</SettingsButton>
						</div>
					</fieldset>
					<div v-if="issuedToken" class="space-y-2 rounded-md border border-(--line) bg-(--paper) p-3">
						<p>{{ t('tokenOnce') }}</p>
						<code class="break-all select-all">{{ issuedToken }}</code>
					</div>
					<div
						v-for="token in tokens"
						:key="token._id"
						data-token-row
						class="flex items-center gap-2 border-t border-(--line) pt-3">
						<span class="min-w-0 truncate" :title="token.name">{{ token.name }}</span>
						<span class="shrink-0 text-(--muted)" aria-hidden="true">·</span>
						<div class="flex shrink-0 items-center gap-1 text-(--muted)">
							<span role="img" :aria-label="token.type.toUpperCase()" :title="token.type.toUpperCase()">
								<LucidePlug v-if="token.type === 'mcp'" class="size-4" aria-hidden="true" />
								<LucideCode v-else class="size-4" aria-hidden="true" />
							</span>
							<span role="img" :aria-label="t(token.permission)" :title="t(token.permission)">
								<LucideEye v-if="token.permission === 'read'" class="size-4" aria-hidden="true" />
								<LucideFilePen v-else class="size-4" aria-hidden="true" />
							</span>
						</div>
						<div class="ml-auto flex shrink-0 gap-2">
							<SettingsButton icon-only :disabled="saving" :aria-label="t('editTokenProjects')" :title="t('editTokenProjects')" @click="openProjectPicker(token, $event.currentTarget)">
								<LucidePencil class="size-4" aria-hidden="true" />
							</SettingsButton>
							<SettingsButton compact danger :disabled="saving" @click="revoke(token._id)">
								{{ t('revoke') }}
							</SettingsButton>
						</div>
					</div>
				</SettingsSection>
			</div>
		</div>
		<template v-if="projectPickerOpen" #actions>
			<AppButton :disabled="saving" @click="closeProjectPicker()">{{ t('cancel') }}</AppButton>
			<AppButton type="submit" form="integration-project-picker" primary :disabled="pickerDisabled">
				{{ t(editingToken ? 'save' : 'applyProjectSelection') }}
			</AppButton>
		</template>
		<template v-else-if="panel.type === 'move'" #actions>
			<AppButton :disabled="saving" @click="closePanel()">{{ t('cancel') }}</AppButton>
			<AppButton primary :disabled="saving || !validMoveDestination" @click="confirmMove">
				{{ t(node?.kind === 'project' ? 'moveBefore' : 'moveHere') }}
			</AppButton>
		</template>
		<template v-else-if="hasForm" #actions>
			<AppButton :disabled="saving" @click="closePanel()">{{ t('cancel') }}</AppButton>
			<AppButton
				type="submit"
				:form="panel.type === 'project' ? 'notes-project' : 'notes-share'"
				:disabled="saving || (panel.type === 'share' && inherited)"
				primary>
				{{ t(saving ? 'saving' : 'save') }}
			</AppButton>
		</template>
		<template v-else-if="panel.type === 'profile'" #actions>
			<div class="flex w-full items-center gap-2">
				<AppButton :disabled="signingOut || importing" :aria-busy="signingOut" class="mr-auto" @click="signOut">
					<LucideLogOut class="size-4" />
					{{ t('logout') }}
				</AppButton>
				<AppButton :disabled="signingOut || importing" @click="closePanel()">{{ t('close') }}</AppButton>
			</div>
		</template>
	</component>
</template>
<script setup>
import { descendants } from '../../../shared/utils/structure.js'
const { t, locale } = useI18n()
const mcpAddress = `${useRequestURL().origin}/mcp`
const projectPickerOpen = ref(false)
const projectTrigger = ref(null)
const editingToken = ref(null)
let projectPickerScroll = 0
let projectPickerTrigger
const projectBody = () => projectTrigger.value?.$el.closest('.overflow-y-auto')
const openProjectPicker = async (token = null, trigger = projectTrigger.value?.$el) => {
	if (saving.value || (!token && tokenFormDisabled.value)) return
	editingToken.value = token
	projectPickerTrigger = trigger
	projectPickerScroll = projectBody()?.scrollTop || 0
	projectPickerOpen.value = true
	await nextTick()
	const body = projectBody()
	if (body) body.scrollTop = 0
}
const closeProjectPicker = async () => {
	if (saving.value) return
	projectPickerOpen.value = false
	editingToken.value = null
	await nextTick()
	const body = projectBody()
	if (body) body.scrollTop = projectPickerScroll
	projectPickerTrigger?.focus({ preventScroll: true })
}
const applyProjectSelection = async (ids) => {
	if (pickerDisabled.value) return
	if (!editingToken.value) {
		tokenValues.projects = ids.filter(id => allowedProjectIds.value.has(id))
		return closeProjectPicker()
	}
	const id = editingToken.value._id
	await guarded(async () => {
		const updated = await request(`tokens/${id}`, { method: 'PATCH', body: { projects: ids } })
		tokens.value = tokens.value.map(token => token._id === id ? updated : token)
	})
	if (!error.value) await closeProjectPicker()
}
const { nodeAction } = useNodeActions()
const profileModal = resolveComponent('AppModal')
const dropdownPanel = resolveComponent('AppPopover')
const { getPanelTrigger, getPanelBounds } = useNotesPanel()
const { reload: reloadTheme, scrollTop: restoredScrollTop } = useThemeReload()
const { state, operation, request, move, applyAppearance, ancestors, effectiveShare, sync, logout } = useNotes()
const identity = state.value.panel
const closePanel = () => {
	if (importing.value) return
	if (state.value.panel === identity) state.value.panel = null
}
const panel = computed(() => identity)
const node = computed(() => state.value.workspace.nodes[panel.value?.id])
const values = reactive({
	title: '',
	description: '',
	color: '#655277',
	icon: 'Folder',
	enabled: false,
	slug: '',
	password: undefined,
	confirmReplace: false,
	mcpEnabled: false,
	apiEnabled: false,
})
const preferences = reactive({
	theme: 'notes',
	appearance: 'system',
	locale: locale.value,
	dateFormat: 'yyyy-MM-dd',
	timeFormat: '24h',
})
const error = ref(''),
	issuedToken = ref(''),
	tokens = ref([]),
	apiEnabled = ref(false),
	mcpEnabled = ref(false)
const saving = ref(false)
const signingOut = ref(false)
const signOut = async () => {
	if (signingOut.value) return
	signingOut.value = true
	try {
		await logout()
	} catch (failure) {
		error.value = failure.code || 'serverError'
	} finally {
		signingOut.value = false
	}
}
const { importTask, importing, importBusy, chooseImport, performImport, checkImport, clearImport } = useImport()
const { ask } = useConfirmation()
const abandonImport = async () => {
	if (await ask(t('importClearConfirm'))) await clearImport()
}
const importWarnings = computed(() =>
	[...new Set(importTask.value.result?.warnings || importTask.value.preview?.warnings || [])].map((warning) => {
		if (warning === 'Block structure normalized to text') return t('importPlainText')
		const prefixes = {
			'Unsupported block: ': 'importUnsupportedBlock',
			'Invalid JSON: ': 'importInvalidFile',
			'Attachment not imported: ': 'importSkippedFile',
		}
		const prefix = Object.keys(prefixes).find((value) => warning.startsWith(value))
		return prefix ? t(prefixes[prefix], { name: warning.slice(prefix.length) }) : warning
	})
)
const containerProps = computed(() =>
	panel.value.type === 'profile'
		? {
				busy: importing.value,
				bodyClass: projectPickerOpen.value ? 'flex min-h-0 overflow-hidden' : 'min-h-0 overflow-y-auto p-5',
			}
		: {
				anchor: getPanelTrigger,
				bounds: getPanelBounds,
				width: 440,
				menu: panel.value.type === 'actions',
				busy: saving.value,
				focusContent: hasForm.value,
				compact: panel.value.type !== 'share',
			}
)
const hasForm = computed(() => ['project', 'share'].includes(panel.value.type))
const replacesShares = computed(() =>
	descendants(state.value.workspace, panel.value.id).some((id) => state.value.workspace.nodes[id]?.share)
)
const ensureSlug = () => {
	if (values.enabled && !values.slug) values.slug = crypto.randomUUID().replaceAll('-', '').slice(0, 12)
}
const projects = computed(() =>
	Object.values(state.value.workspace.nodes).filter((n) => n.kind === 'project' && n.status === 'active')
)
const preferenceFields = computed(() => [
	{
		key: 'locale',
		label: 'language',
		options: [
			{ value: 'sv', label: 'Svenska' },
			{ value: 'en', label: 'English' },
		],
	},
	{
		key: 'theme',
		label: 'theme',
		options: ['notes', 'mood', 'offlist'].map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) })),
	},
	{
		key: 'appearance',
		label: 'appearance',
		options: ['system', 'light', 'dark'].map((value) => ({ value, label: t(value) })),
	},
	{
		key: 'dateFormat',
		label: 'dateFormat',
		options: ['yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy'].map((value) => ({ value, label: value.toUpperCase() })),
	},
	{
		key: 'timeFormat',
		label: 'timeFormat',
		options: [
			{ value: '24h', label: t('time24') },
			{ value: '12h', label: t('time12') },
		],
	},
])
const { tokenValues, integrationOptions, tokenFormDisabled, allowedProjectIds, canCreateToken } =
	useIntegrationTokenForm({ apiEnabled, mcpEnabled, projects, saving })
const pickerDisabled = computed(() => editingToken.value ? saving.value : tokenFormDisabled.value)
const pickerAllowedIds = computed(() => {
	const token = editingToken.value
	if (!token) return allowedProjectIds.value
	return new Set(projects.value.filter(project => project[`${token.type}Enabled`]).map(project => project.id))
})
watch(
	() => [state.value.workspace.settings.apiEnabled, state.value.workspace.settings.mcpEnabled, saving.value],
	([api, mcp]) => {
		if (saving.value) return
		apiEnabled.value = !!api
		mcpEnabled.value = !!mcp
	},
	{ immediate: true }
)
const panelTitle = computed(() =>
	t(
		{ actions: 'more', project: 'project', profile: 'profile', share: 'sharing', move: 'move' }[panel.value?.type] ||
			'profile'
	)
)
const inherited = computed(
	() =>
		!!ancestors(state.value.workspace, panel.value.id)
			.slice(0, -1)
			.find((n) => n.shared)
)
const moveDestination = ref(undefined)
const moveExpanded = ref([])
const moveExcluded = computed(() => new Set([panel.value.id, ...descendants(state.value.workspace, panel.value.id)]))
const moveRoots = computed(() => [
	...(node.value?.kind === 'project' ? [] : [{ id: null, title: t('inbox'), kind: 'project', icon: 'Inbox', status: 'active' }]),
	...state.value.workspace.projects.map(id => state.value.workspace.nodes[id])
].filter(target => target?.status === 'active' && !moveExcluded.value.has(target.id)))
const validMoveDestination = computed(() => {
	const id = moveDestination.value
	if (id === undefined || moveExcluded.value.has(id)) return false
	if (id === null) return node.value?.kind !== 'project' && !!node.value?.parentId
	const target = state.value.workspace.nodes[id]
	return target?.status === 'active' && (node.value?.kind === 'project' ? target.kind === 'project' : id !== node.value?.parentId)
})
const confirmMove = () => {
	if (!validMoveDestination.value) return
	const target = state.value.workspace.nodes[moveDestination.value]
	return guarded(() => move(panel.value.id,
		node.value.kind === 'project' ? null : moveDestination.value,
		node.value.kind === 'project' ? target.order : undefined))
}
const guarded = async (action) => {
	if (saving.value) return
	saving.value = true
	error.value = ''
	try {
		await action()
	} catch (e) {
		error.value = e.code || e.data?.error || 'serverError'
	} finally {
		saving.value = false
	}
}
const act = (type) =>
	guarded(async () => {
		if (await nodeAction(type, panel.value.id)) closePanel()
	})
const purge = () => act('purge')
const { copying, copied: copiedMarkdown, copyMarkdown } = useCopyMarkdown()
const copyMarkdownLabel = computed(() => t(copiedMarkdown.value ? 'markdownCopied' : copying.value ? 'copyingMarkdown' : 'copyAsMarkdown'))
const copySelectedMarkdown = () => guarded(() => copyMarkdown(panel.value.id))
const { printing, printDocument } = usePrintDocument()
const printSelected = () => guarded(async () => {
	const id = panel.value.id
	if (navigator.standalone && /\biPhone;/.test(navigator.userAgent)) {
		closePanel()
		await ask(t('printOpenInSafari'), {
			title: t('printDocument'),
			copyURL: new URL(`/doc/${encodeURIComponent(id)}`, window.location.origin).href,
		})
		return
	}
	await printDocument(id)
	closePanel()
})
const saveProject = () =>
	guarded(async () => {
		const id = panel.value.id || crypto.randomUUID()
		if (!panel.value.id) await operation({ type: 'project.create', id, title: values.title })
		await operation({
			type: 'node.update',
			id,
			title: values.title,
			description: values.description,
			icon: values.icon,
			color: values.color,
			mcpEnabled: values.mcpEnabled,
			apiEnabled: values.apiEnabled,
		})
		closePanel()
	})
const shareURL = computed(() => node.value?.share
	? new URL(`/p/${encodeURIComponent(node.value.share.slug)}`, window.location.origin).href
	: '')
const copiedShareURL = ref('')
const shareLinkCopied = computed(() => !!copiedShareURL.value && copiedShareURL.value === shareURL.value)
let copyFeedbackTimer
onBeforeUnmount(() => clearTimeout(copyFeedbackTimer))
const copyShareLink = async () => {
	const url = shareURL.value
	try {
		await navigator.clipboard.writeText(url)
		clearTimeout(copyFeedbackTimer)
		copiedShareURL.value = url
		copyFeedbackTimer = setTimeout(() => { copiedShareURL.value = '' }, 2000)
	} catch {
		error.value = 'copyShareLinkFailed'
	}
}
const saveShare = () =>
	guarded(async () => {
		if (replacesShares.value && values.enabled && !values.confirmReplace) return
		await operation({
			type: 'share',
			id: panel.value.id,
			enabled: values.enabled,
			slug: values.slug || undefined,
			password: values.password,
			confirmReplace: !replacesShares.value || values.confirmReplace,
		})
		closePanel()
	})
const savePreferences = (field) =>
	guarded(async () => {
		state.value.workspace.preferences = { ...preferences }
		applyAppearance()
		await operation({ type: 'preferences', values: { ...preferences } })
		if (['theme', 'appearance'].includes(field)) await reloadTheme()
	})
const saveAPI = () =>
	guarded(() => operation({ type: 'settings', apiEnabled: apiEnabled.value, mcpEnabled: mcpEnabled.value }))
const createToken = () => {
	if (!canCreateToken.value) return
	const values = { ...tokenValues, name: tokenValues.name.trim(), projects: [...tokenValues.projects] }
	return guarded(async () => {
		issuedToken.value = (await request('tokens', { method: 'POST', body: values })).token
		tokens.value = await request('tokens')
	})
}
const revoke = (id) =>
	guarded(async () => {
		await request(`tokens/${id}`, { method: 'DELETE' })
		tokens.value = await request('tokens')
	})
watch(
	() => [panel.value.type, panel.value.id],
	() => {
		Object.assign(values, {
			title: node.value?.title || '',
			description: node.value?.description || '',
			icon: node.value?.icon || 'Folder',
			color: node.value?.color || '#655277',
			enabled: !!node.value?.shared,
			slug: node.value?.share?.slug || '',
			password: undefined,
			confirmReplace: false,
			mcpEnabled: !!node.value?.mcpEnabled,
			apiEnabled: !!node.value?.apiEnabled,
		})
		ensureSlug()
		error.value = ''
	},
	{ immediate: true }
)
onMounted(async () => {
	Object.assign(preferences, state.value.workspace.preferences)
	if (panel.value.type === 'profile')
		await guarded(async () => {
			tokens.value = await request('tokens')
		})
	if (restoredScrollTop.value !== null) {
		await nextTick()
		const content = document.querySelector('[role="dialog"] > .overflow-y-auto')
		if (content) content.scrollTop = restoredScrollTop.value
		restoredScrollTop.value = null
	}
})
</script>
