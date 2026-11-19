<template>
	<div class="space-y-3">
		<div class="flex flex-wrap items-center gap-4">
			<img v-if="state.user?.image" :src="state.user.image" alt="" class="size-16 shrink-0 rounded-full object-cover" />
			<span v-else class="flex size-16 shrink-0 items-center justify-center rounded-full bg-(--soft) text-[16px] text-(--accent)">{{ state.user?.name?.[0] }}</span>
			<div class="flex items-center gap-2">
				<SettingsButton tag="label" compact class="cursor-pointer"><LucideCamera class="size-4" />{{ t('profileImage') }}<input type="file" accept="image/png,image/jpeg,image/webp" :disabled="busy" class="sr-only" :aria-label="t('profileImage')" @change="choose" /></SettingsButton>
				<SettingsButton v-if="state.user?.image" icon-only danger :disabled="busy" :aria-label="t('removeProfileImage')" :title="t('removeProfileImage')" @click="remove"><LucideTrash2 class="size-4" /></SettingsButton>
			</div>
		</div>
		<ProfileImageCrop v-if="source" :source="source" :name="state.user.name" :busy="busy" @save="save" @cancel="reset" />
		<p v-if="error" role="alert" class="error-message">{{ t(error) }}</p>
	</div>
</template>
<script setup>
const { t } = useI18n()
const { state, request, refresh } = useNotes()
const { ask } = useConfirmation()
const source = shallowRef(null)
const busy = ref(false)
const error = ref('')
let objectURL
const reset = () => {
	source.value = null
	if (objectURL) URL.revokeObjectURL(objectURL)
	objectURL = null
}
const choose = async (event) => {
	const file = event.target.files?.[0]
	event.target.value = ''
	if (!file) return
	error.value = ''
	reset()
	if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { error.value = 'avatarInvalid'
		return
	}
	try {
		objectURL = URL.createObjectURL(file)
		const image = new Image()
		image.src = objectURL
		await image.decode()
		if (image.width * image.height > 40000000) throw new Error('avatarInvalid')
		source.value = image
	} catch { reset()
		error.value = 'avatarInvalid'
	}
}
const save = async (data) => {
	busy.value = true
	error.value = ''
	try {
		const bytes = Uint8Array.from(atob(data.split(',')[1]), (character) => character.charCodeAt(0))
		const form = new FormData()
		form.append('file', new Blob([bytes], { type: 'image/webp' }), 'avatar.webp')
		await request('avatar', { method: 'POST', body: form })
		await refresh()
		reset()
	} catch { error.value = 'accountUpdateFailed' }
	finally { busy.value = false }
}
const remove = async () => {
	if (!await ask(t('removeAvatarConfirm'))) return
	busy.value = true
	try {
		await request('avatar', { method: 'DELETE' })
		if ('caches' in window) {
			const cache = await caches.open('notes-private-files-v1')
			const keys = await cache.keys()
			await Promise.all(keys.filter((key) => new URL(key.url).pathname === '/api/app/avatar').map((key) => cache.delete(key)))
		}
		await refresh()
	} catch { error.value = 'accountUpdateFailed' }
	finally { busy.value = false }
}
onBeforeUnmount(reset)
</script>
