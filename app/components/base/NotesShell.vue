<template>
	<div
		v-if="state.ready"
		@dragstart="beginTreeDrag"
		@dragend="cancelTreeDrag"
		class="relative flex h-dvh flex-col overflow-hidden pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] pb-[env(safe-area-inset-bottom)]">
		<!-- WebKit samples the fixed box's background color. Clipping it to empty text keeps the box unpainted. -->
		<div aria-hidden="true" class="pointer-events-none fixed inset-x-0 top-0 z-60 hidden h-5 bg-(--surface) bg-clip-text md:pointer-fine:block" />
		<div class="flex min-h-0 flex-1">
			<button
				v-if="state.mobile"
				type="button"
				class="absolute inset-0 z-30 bg-black/30 md:hidden"
				:aria-label="t('close')"
				@click="state.mobile = false" />
			<aside
				ref="sidebar"
				:inert="phoneLandscape || (smallScreen && !state.mobile)"
				:aria-hidden="phoneLandscape || (smallScreen && !state.mobile) ? true : undefined"
				:aria-label="t('menu')"
				:aria-modal="state.mobile ? true : undefined"
				:role="state.mobile ? 'dialog' : undefined"
				class="absolute inset-y-0 left-0 z-40 flex w-[min(260px,calc(100vw-40px))] flex-col border-r border-(--line) bg-(--paper) pr-2.5 pl-[max(10px,env(safe-area-inset-left))] pt-[env(safe-area-inset-top)] pb-[max(7px,env(safe-area-inset-bottom))] transition-transform md:pt-0 md:relative md:z-auto md:w-(--sidebar-width) md:translate-x-0"
				:style="{ '--sidebar-width': `${sidebarWidth}px` }"
				:class="[state.mobile ? 'translate-x-0' : '-translate-x-full', { 'hidden!': phoneLandscape, 'md:hidden': sidebarHidden }]"
				@keydown="sidebarKeys"
				@touchstart="touchX = $event.touches[0].clientX"
				@touchend="swipe">
				<div class="shrink-0" data-sidebar-navigation>
					<div class="flex h-12 items-center justify-between px-2 md:mb-2">
						<b class="text-[26px] font-semibold tracking-tight">
							notes
							<span class="text-(--accent)">.</span>
						</b>
						<div class="flex items-center gap-1">
							<SyncStatus />
							<button class="p-1 md:hidden" :aria-label="t('close')" @click="state.mobile = false">
								<AppIcon name="X" />
							</button>
						</div>
					</div>
					<button
						v-for="item in navigation"
						:key="item.view"
						:data-drop-id="item.view === 'inbox' ? '' : undefined"
						class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left inset-ring inset-ring-transparent hover:bg-(--soft) hover:inset-ring-(--paper-hover-border) md:pointer-fine:py-1"
						:class="state.view === item.view ? 'bg-(--soft) inset-ring-(--paper-active-border)!' : ''"
						@click="select(item.view)">
						<AppIcon :name="item.icon" />
						{{ t(item.label) }}
					</button>
					<label class="flex items-center gap-2 px-2 py-1.5 md:pointer-fine:py-1">
						<AppIcon name="Search" />
						<input
							v-model="state.query"
							type="search"
							:aria-label="t('search')"
							:placeholder="t('search')"
							class="notes-search min-w-0 flex-1 border-0 bg-transparent p-0 placeholder:text-(--ink)"
							@input="search" />
					</label>
				</div>
				<div class="mt-2 flex min-h-9 shrink-0 items-center justify-between pl-2 font-semibold">
					<span>{{ t('project') }}</span>
					<button
						class="rounded p-1 hover:bg-(--soft) inset-ring inset-ring-transparent hover:inset-ring-(--paper-hover-border)"
						:aria-label="t('newProject')"
						@click="openPanel('project', undefined, $event)">
						<AppIcon name="Plus" />
					</button>
				</div>
				<div
					ref="treeScroll"
					data-project-scroll
					:data-above="above"
					:data-below="below"
					class="min-h-0 flex-1 overflow-y-auto overscroll-contain border-y border-transparent"
					:class="{ 'border-t-(--line)!': above, 'border-b-(--line)!': below }"
					@scroll="updateScrollEdges">
					<div ref="treeContent"><ProjectTree :nodes="projects" /></div>
				</div>
				<div class="shrink-0 pt-2" data-sidebar-account>
					<button
						v-for="item in lowerNavigation"
						:class="state.view === item.view ? 'bg-(--soft) inset-ring-(--paper-active-border)!' : ''"
						:key="item.view"
						class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left inset-ring inset-ring-transparent hover:bg-(--soft) hover:inset-ring-(--paper-hover-border) md:pointer-fine:py-1"
						@click="select(item.view)">
						<AppIcon :name="item.icon" />
						{{ t(item.label) }}
					</button>
					<div class="mt-2 border-t border-(--line) pt-2">
						<button
							class="flex w-full items-center gap-2 rounded p-2 text-left hover:bg-(--soft) inset-ring inset-ring-transparent hover:inset-ring-(--paper-hover-border)"
							:aria-label="`${state.user?.name || ''} ${t('settings')}`.trim()"
							:title="t('settings')"
							@click="openPanel('profile', undefined, $event)">
							<img
								v-if="state.user?.image"
								:src="state.user.image"
								alt=""
								class="size-8 shrink-0 rounded-full object-cover" />
							<span v-else class="flex size-7 items-center justify-center rounded-full bg-(--soft) text-(--accent)">
								{{ state.user?.name?.[0] || 'N' }}
							</span>
							<span class="min-w-0 leading-5">{{ state.user?.name }}</span>
						</button>
					</div>
				</div>
				<div
					role="separator"
					tabindex="0"
					aria-orientation="vertical"
					:aria-label="t('sidebarWidth')"
					:aria-valuemin="179"
					:aria-valuemax="560"
					:aria-valuenow="sidebarWidth"
					class="absolute inset-y-0 right-0 z-10 hidden w-2 cursor-col-resize touch-none md:block"
					@pointerdown="startResize"
					@keydown="resizeKeys" />
			</aside>
			<div class="notes-document-layout relative flex min-w-0 flex-1" :data-outline-open="outlineOpen ? '' : undefined" :style="{ '--notes-outline-top': outlineTop }">
				<main ref="main" tabindex="-1" :inert="state.mobile" class="min-w-0 flex-1 overflow-y-auto" @scroll.passive="updateOutlineTop">
					<div class="flex h-12 items-center gap-3 border-b border-(--line) px-4">
						<button
							v-if="!phoneLandscape"
							ref="menuButton"
							type="button"
							class="shrink-0 rounded p-1.5 hover:bg-(--soft)"
							:aria-label="t('menu')"
							:aria-expanded="smallScreen ? state.mobile : !sidebarHidden"
							@click="toggleSidebar">
							<LucidePanelLeft class="size-4" aria-hidden="true" />
						</button>
						<span
							class="min-w-0 truncate text-[14px] text-(--muted)"
							:class="phoneLandscape ? 'max-w-[40%] shrink-0' : 'flex-1'">
							{{ breadcrumb }}
						</span>
						<span
							v-if="phoneLandscape"
							role="status"
							:title="t('menuPortraitHint')"
							class="min-w-0 flex-1 truncate text-right text-[14px] text-(--muted)">
							{{ t('menuPortraitHint') }}
						</span>
						<button
							v-if="state.view === 'document' && selected"
							ref="outlineButton"
							type="button"
							class="shrink-0 rounded p-1 hover:bg-(--soft)"
							:class="{ 'bg-(--soft)': outlineOpen }"
							:aria-label="t('documentOutline')"
							:title="t('documentOutline')"
							:aria-expanded="outlineOpen"
							:aria-controls="outlineOpen ? 'document-outline' : undefined"
							@click="toggleOutline">
							<LucideListTree class="size-4" aria-hidden="true" />
						</button>
						<button
							v-if="['document', 'project'].includes(state.view)"
							class="flex shrink-0 items-center gap-1 rounded p-1 hover:bg-(--soft)"
							:aria-label="t('sharing')"
							:title="t('sharing')"
							@click="openPanel('share', state.selected, $event)">
							<AppIcon :name="effectiveShare(state.workspace, state.selected) ? 'Globe' : 'LockKeyhole'" />
							<span v-if="state.view === 'project'" class="hidden sm:inline">{{ t('sharing') }}</span>
						</button>
						<button
							v-if="state.selected"
							class="rounded p-1 hover:bg-(--soft)"
							:aria-label="t('more')"
							@click="openPanel('actions', state.selected, $event)">
							<AppIcon name="Ellipsis" />
						</button>
						<button
							v-else-if="!['trash', 'archive', 'files'].includes(state.view)"
							class="flex items-center gap-1 rounded px-2 py-1 hover:bg-(--soft)"
							@click="create(null)">
							<AppIcon name="Plus" />
							{{ t('newDocument') }}
						</button>
						<div v-if="state.view === 'trash'" class="flex shrink-0 gap-1">
							<AppButton compact :disabled="processing" @click="runAction(cleanTrash)">
								{{ t('cleanTrash') }}
							</AppButton>
							<AppButton compact danger :disabled="!list.length || processing" @click="runAction(emptyTrash)">
								<LucideTrash2 class="size-3.5" aria-hidden="true" />
								{{ t('emptyTrash') }}
							</AppButton>
						</div>
					</div>
					<DocumentEditor ref="documentEditor" v-if="state.view === 'document' && selected" :key="selected.id" :id="selected.id" />
					<FilesView v-else-if="state.view === 'files'" />
					<div v-else class="p-5 sm:px-6">
						<div v-if="state.view === 'trash'" role="status">
							<p v-if="cleanupNotice" class="mb-3 text-sm"
								:class="cleanupNotice.key === 'cleanTrashFailed' ? 'text-(--status-error)' : 'text-(--muted)'">
								{{ t(cleanupNotice.key, cleanupNotice.values || {}) }}
							</p>
						</div>
						<div v-if="['project', 'inbox', 'search'].includes(state.view)" class="mb-5 flex items-start gap-3">
							<div class="min-w-0 flex-1">
								<p v-if="state.view === 'inbox'" class="mt-2 text-(--muted)">{{ t('inboxHelp') }}</p>
								<p v-if="state.view === 'project'" class="mt-2 text-(--muted)">{{ selected?.description }}</p>
								<p v-if="state.view === 'search'" class="mt-2 text-(--muted)">{{ t('searchHelp') }}</p>
							</div>
							<button
								v-if="state.view === 'project'"
								class="rounded p-1 hover:bg-(--soft)"
								:aria-label="t('edit')"
								@click="openPanel('project', state.selected, $event)">
								<AppIcon name="SlidersHorizontal" />
							</button>
						</div>
						<label v-if="state.view === 'search'" class="mb-4 flex items-center gap-2 text-[14px] text-(--muted)">
							<input v-model="includeInactive" type="checkbox" @change="search" />
							{{ t('includeInactive') }}
						</label>
						<section
							v-if="state.view === 'start' && !projects.length && !recent.length"
							class="mx-auto flex max-w-xl flex-col items-center px-5 py-16 text-center">
							<LucideNotebookPen class="mb-5 size-10 text-(--accent)" aria-hidden="true" />
							<h2 class="text-[20px]!">{{ t('emptyStartTitle') }}</h2>
							<p class="mt-3 max-w-sm text-[14px] leading-6 text-(--muted)">{{ t('emptyStartHelp') }}</p>
							<div class="mt-6 flex flex-wrap justify-center gap-3">
								<AppButton @click="openPanel('project', undefined, $event)">{{ t('firstProject') }}</AppButton>
								<AppButton primary @click="create(null)">{{ t('firstDocument') }}</AppButton>
							</div>
						</section>
						<div v-else-if="state.view === 'start'" class="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
							<section>
								<h2 class="mb-2">{{ t('recent') }}</h2>
								<DocumentList :nodes="recent" />
							</section>
							<section>
								<h2 class="mb-2">{{ t('project') }}</h2>
								<DocumentList :nodes="projects" :show-date="false" />
							</section>
						</div>
						<div v-else>
							<div
								v-if="state.view === 'project'"
								class="mb-2 flex items-center justify-between border-b border-(--line) py-2">
								<h2>{{ t('documents') }}</h2>
								<button class="rounded px-2 py-1 hover:bg-(--soft)" @click="create(selected.id)">
									+ {{ t('newDocument') }}
								</button>
							</div>
							<DocumentList
								:nodes="list"
								:inactive="['archive', 'trash'].includes(state.view)"
								:trash="state.view === 'trash'"
								:busy="processing"
								@restore="runAction(() => nodeAction('restore', $event))"
								@remove="runAction(() => nodeAction('purge', $event))" />
						</div>
					</div>
				</main>
				<button v-if="outlineOpen" type="button" tabindex="-1" class="notes-outline-backdrop absolute inset-x-0 bottom-0 z-20 bg-black/30"
					:aria-label="t('close')" @click="closeOutline()" />
				<DocumentOutline v-if="outlineOpen && selected" ref="outlinePanel"
					:headings="documentEditor?.headings || []" :block-drag="documentEditor?.blockDrag" :editable="selected.status === 'active'" @jump="jumpToHeading" @close="closeOutline()" />
			</div>
		</div>

		<NotesPanel v-if="state.panel" :key="`${state.panel.type}:${state.panel.id || ''}`" />
	</div>
	<p v-else class="p-5" role="status">{{ t('loading') }}</p>
</template>
<script setup>
const { beginNative: beginTreeDrag, cancel: cancelTreeDrag } = useTreeDrag()
const { restore: restoreThemeSettings } = useThemeReload()
const { t } = useI18n()
const { openPanel } = useNotesPanel()
const { nodeAction, emptyTrash, cleanTrash: cleanOrphans } = useNodeActions()
const cleanupNotice = ref(null)
const cleanTrash = async () => {
	cleanupNotice.value = null
	try {
		const counts = await cleanOrphans()
		if (counts) cleanupNotice.value = {
			key: counts.documents || counts.attachments ? 'cleanTrashResult' : 'cleanTrashEmpty',
			values: counts
		}
	} catch {
		cleanupNotice.value = { key: 'cleanTrashFailed' }
	}
}
const processing = ref(false)
const runAction = async (action) => {
	if (processing.value) return
	processing.value = true
	try {
		await action()
	} catch (error) {
		state.value.error = error.code || 'serverError'
	} finally {
		processing.value = false
	}
}
const route = useRoute()
const smallScreen = ref(false)
const phoneLandscape = usePhoneLandscape()
const includeInactive = ref(false)
let media
const updateScreen = () => {
	smallScreen.value = media.matches
	if (!media.matches) state.value.mobile = false
}
const {
	state,
	boot,
	select,
	create,
	ancestors,
	childrenOf,
	effectiveShare,
	request,
	searchLocal,
	openDocument,
	getNavigationVersion,
	operation,
} = useNotes()
const sidebarWidth = ref(179)
const sidebarHidden = ref(false)
const outlineOpen = ref(false)
const outlineTop = ref(undefined)
const outlineButton = ref(null)
const outlinePanel = ref(null)
const documentEditor = ref(null)
const updateOutlineTop = () => {
	if (!outlineOpen.value || !main.value) return
	const toolbar = documentEditor.value?.toolbarElement
	outlineTop.value = toolbar
		? `${Math.max(0, toolbar.getBoundingClientRect().bottom - main.value.getBoundingClientRect().top)}px`
		: undefined
}
watch([outlineOpen, () => documentEditor.value?.toolbarElement], ([open, toolbar], _, onCleanup) => {
	if (!open) return
	updateOutlineTop()
	if (!toolbar) return
	const observer = new ResizeObserver(updateOutlineTop)
	observer.observe(toolbar)
	onCleanup(() => observer.disconnect())
}, { flush: 'post' })
const closeOutline = (restoreFocus = true) => {
	outlineOpen.value = false
	if (!restoreFocus) return
	nextTick(() => {
		const button = outlineButton.value
		const visible = button && main.value && button.getBoundingClientRect().bottom > main.value.getBoundingClientRect().top
		const target = visible ? button : main.value
		target?.focus({ preventScroll: true })
	})
}
const toggleOutline = async (event) => {
	if (outlineOpen.value) return closeOutline()
	outlineOpen.value = true
	if (event.detail === 0) {
		await nextTick()
		outlinePanel.value?.focusClose()
	}
}
const toggleSidebar = () => {
	if (!smallScreen.value) {
		sidebarHidden.value = !sidebarHidden.value
		return
	}
	if (!state.value.mobile) closeOutline(false)
	state.value.mobile = !state.value.mobile
}
const jumpToHeading = (position) => {
	if (!outlinePanel.value?.isDocked()) closeOutline()
	documentEditor.value?.scrollToHeading(position, main.value)
}
watch([() => state.value.selected, () => state.value.view], () => closeOutline(false))
let resizePointer
const persistWidth = () => operation({ type: 'preferences', values: { sidebarWidth: sidebarWidth.value } })
const startResize = (event) => {
	if (event.button !== 0 || resizePointer) return
	event.preventDefault()
	event.currentTarget.setPointerCapture(event.pointerId)
	resizePointer = { x: event.clientX, width: sidebarWidth.value }
	const moveWidth = (next) => {
		sidebarWidth.value = Math.round(Math.max(179, Math.min(560, resizePointer.width + next.clientX - resizePointer.x)))
	}
	const handle = event.currentTarget
	const finish = () => {
		handle.removeEventListener('pointermove', moveWidth)
		handle.removeEventListener('pointerup', finish)
		handle.removeEventListener('pointercancel', finish)
		resizePointer = null
		persistWidth()
	}
	handle.addEventListener('pointermove', moveWidth)
	handle.addEventListener('pointerup', finish)
	handle.addEventListener('pointercancel', finish)
}
const resizeKeys = (event) => {
	if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
	event.preventDefault()
	sidebarWidth.value =
		event.key === 'Home'
			? 179
			: event.key === 'End'
				? 560
				: Math.max(179, Math.min(560, sidebarWidth.value + (event.key === 'ArrowRight' ? 20 : -20)))
	persistWidth()
}
watch(
	() => state.value.workspace.preferences.sidebarWidth,
	(width) => {
		if (resizePointer) return
		sidebarWidth.value = Math.max(179, Math.min(560, width || 179))
	},
	{ immediate: true }
)
const sidebar = ref(null),
	main = ref(null),
	menuButton = ref(null),
	treeScroll = ref(null),
	treeContent = ref(null)
const { above, below, update: updateScrollEdges } = useScrollEdges(treeScroll, treeContent)
const navigation = [
	{ view: 'start', label: 'start', icon: 'House' },
	{ view: 'inbox', label: 'inbox', icon: 'Inbox' },
	{ view: 'starred', label: 'starred', icon: 'Star' },
	{ view: 'public', label: 'public', icon: 'Globe' },
]
const lowerNavigation = [
	{ view: 'files', label: 'filesTitle', icon: 'Files' },
	{ view: 'archive', label: 'archive', icon: 'Archive' },
	{ view: 'trash', label: 'trash', icon: 'Trash2' },
]
const nodes = computed(() => Object.values(state.value.workspace.nodes))
const selected = computed(() => state.value.workspace.nodes[state.value.selected])
const projects = computed(() =>
	state.value.workspace.projects.map((id) => state.value.workspace.nodes[id]).filter((n) => n?.status === 'active')
)
const recent = computed(() =>
	nodes.value
		.filter((n) => n.kind === 'document' && n.status === 'active')
		.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
		.slice(0, 12)
)
const heading = computed(() =>
	state.value.view === 'project'
		? selected.value?.title
		: t(state.value.view === 'start' ? 'overview' : state.value.view === 'files' ? 'filesTitle' : state.value.view)
)
const breadcrumb = computed(() =>
	selected.value
		? ancestors(state.value.workspace, selected.value.id)
				.map((n) => n.title)
				.join(' / ')
		: heading.value
)
const list = computed(() => {
	if (state.value.view === 'project') return childrenOf(state.value.workspace, state.value.selected)
	if (state.value.view === 'starred')
		return nodes.value.filter((n) => n.kind === 'document' && n.starred && n.status === 'active')
	if (state.value.view === 'inbox') return childrenOf(state.value.workspace, null)
	if (state.value.view === 'public') return nodes.value.filter((n) => n.shared && n.status === 'active')
	if (state.value.view === 'search')
		return state.value.searchResults.map((item) => state.value.workspace.nodes[item.id]).filter(Boolean)
	return nodes.value.filter(
		(n) => n.status === state.value.view && state.value.workspace.nodes[n.parentId]?.status !== state.value.view
	)
})
let touchX = 0,
	priorOverflow = '',
	searchTimer
const swipe = (event) => {
	if (event.changedTouches[0].clientX - touchX < -70) state.value.mobile = false
}
const sidebarKeys = (event) => {
	if (!state.value.mobile) return
	if (event.key === 'Escape') state.value.mobile = false
	if (event.key !== 'Tab') return
	const controls = [...sidebar.value.querySelectorAll('button,input')].filter((el) => el.offsetParent !== null)
	if (event.shiftKey && document.activeElement === controls[0]) {
		event.preventDefault()
		controls.at(-1)?.focus()
	}
	if (!event.shiftKey && document.activeElement === controls.at(-1)) {
		event.preventDefault()
		controls[0]?.focus()
	}
}
const search = () => {
	state.value.view = 'search'
	state.value.selected = null
	clearTimeout(searchTimer)
	searchTimer = setTimeout(async () => {
		try {
			state.value.searchResults = await request(
				`search?q=${encodeURIComponent(state.value.query)}&inactive=${includeInactive.value}`
			)
		} catch {
			state.value.searchResults = await searchLocal(state.value.query, includeInactive.value)
		}
	}, 200)
}
watch(phoneLandscape, (blocked) => {
	if (blocked) state.value.mobile = false
})
watch(
	() => state.value.mobile,
	async (open) => {
		if (open) {
			if (phoneLandscape.value) {
				state.value.mobile = false
				return
			}
			priorOverflow = document.body.style.overflow
			document.body.style.overflow = 'hidden'
			await nextTick()
			sidebar.value?.querySelector('button')?.focus()
		} else {
			document.body.style.overflow = priorOverflow
			await nextTick()
			if (!state.value.panel) (phoneLandscape.value ? main.value : menuButton.value)?.focus({ preventScroll: true })
		}
	}
)
watch(
	() => route.params.id || route.query.document,
	(id) => {
		if (state.value.ready && id && state.value.selected !== id && state.value.workspace.nodes[id]) openDocument(id)
		else if (!id && state.value.ready && state.value.view === 'document') select('start')
	}
)
onMounted(async () => {
	const navigationAtMount = getNavigationVersion()
	media = window.matchMedia('(max-width: 767px)')
	updateScreen()
	media.addEventListener('change', updateScreen)
	await boot()
	if (!state.value.ready) return
	const id = route.params.id || route.query.document
	if (getNavigationVersion() === navigationAtMount && id && state.value.workspace.nodes[id]) {
		await openDocument(id)
	}
	await restoreThemeSettings()
})
onBeforeUnmount(() => {
	cancelTreeDrag()
	media?.removeEventListener('change', updateScreen)
	document.body.style.overflow = priorOverflow
	clearTimeout(searchTimer)
})
</script>
