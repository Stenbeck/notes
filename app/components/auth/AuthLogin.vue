<template>
	<AuthShell>
		<AuthButton v-if="!emailMode" type="button" :loading="busy && action === 'passkey'" :disabled="busy" @click="passkey">
			<template #icon><LucideKeyRound class="size-4" aria-hidden="true" /></template>
			{{ t('signInPasskey') }}
		</AuthButton>
		<form v-if="emailMode" class="space-y-4" @submit.prevent="magic">
			<label class="block text-[14px] text-(--ink)">{{ t('email') }}
				<input ref="emailInput" type="email" name="email" required autocomplete="email" :disabled="busy" :placeholder="t('emailPlaceholder')"
					class="mt-1.5 min-h-[44px] w-full rounded-md border border-(--line) bg-(--surface) px-3 py-2.5 text-[14px] placeholder:text-(--muted)" />
			</label>
			<p v-if="notice" role="status" class="rounded-md bg-(--soft) px-3 py-2.5 text-[14px] leading-6">{{ t(notice) }}</p>
			<AuthButton type="submit" :loading="busy && action === 'email'" :disabled="busy">
				<template #icon><LucideMail class="size-4" aria-hidden="true" /></template>
				{{ t('magicLink') }}
			</AuthButton>
		</form>
		<div class="my-6 flex items-center gap-4 text-[14px] text-(--muted)">
			<span class="h-px flex-1 bg-(--line)"></span>{{ t('or') }}<span class="h-px flex-1 bg-(--line)"></span>
		</div>
		<AuthButton type="button" secondary :disabled="busy" @click="selectMode(!emailMode)">
			<template #icon>
				<LucideKeyRound v-if="emailMode" class="size-4" aria-hidden="true" />
				<LucideMail v-else class="size-4" aria-hidden="true" />
			</template>
			{{ t(emailMode ? 'backToPasskey' : 'useEmailLink') }}
		</AuthButton>
		<p v-if="error" role="alert" class="error-message mt-4 text-[14px] leading-6">{{ t(error) }}</p>
		<template #footer>
			<p v-if="setup?.success && !setup.data.complete" class="mt-6 text-center text-[14px] text-(--muted)"><NuxtLink to="/setup" class="underline underline-offset-4 hover:text-(--accent)">{{ t('setup') }}</NuxtLink></p>
		</template>
	</AuthShell>
</template>
<script setup>
const { t } = useI18n()
const { busy, error, notice, signInPasskey, sendLink } = useAuthFlow()
const emailInput = ref(null)
const emailMode = ref(false)
const selectMode = async (useEmail) => {
	emailMode.value = useEmail
	error.value = ''
	notice.value = ''
	if (useEmail) {
		await nextTick()
		emailInput.value?.focus()
	}
}
const action = ref('')
const { data: setup } = await useFetch('/api/setup/status')
const passkey = async () => {
	if (busy.value) return
	action.value = 'passkey'
	await signInPasskey()
}
const magic = async () => {
	if (busy.value || !emailInput.value?.reportValidity()) return
	action.value = 'email'
	await sendLink(emailInput.value.value.trim())
}
</script>
