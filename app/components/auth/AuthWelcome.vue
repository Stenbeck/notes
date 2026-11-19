<template>
	<AuthShell :title="t('createYourPasskey')" :description="t('passkeyEnrollmentHelp')">
		<p v-if="checking" role="status" class="text-[14px] text-(--muted)">{{ t('authChecking') }}</p>
		<form v-else class="space-y-5" @submit.prevent="registerPasskey(keyName)">
			<label class="block text-[14px]">{{ t('passkeyName') }}
				<input v-model="keyName" maxlength="100" autocomplete="off" :disabled="busy" :placeholder="t('passkeyNamePlaceholder')"
					class="mt-1.5 min-h-[44px] w-full rounded-md border border-(--line) bg-(--surface) px-3 py-2.5 text-[14px] placeholder:text-(--muted)" />
			</label>
			<p v-if="error" role="alert" class="error-message text-[14px] leading-6">{{ t(error) }}</p>
			<AuthButton type="submit" :loading="busy">
				<template #icon><LucideKeyRound class="size-4" aria-hidden="true" /></template>
				{{ t('createPasskey') }}
			</AuthButton>
			<button type="button" :disabled="busy" class="w-full py-1 text-[14px] text-(--muted) underline-offset-4 hover:text-(--accent) hover:underline" @click="run(signedIn)">{{ t('doThisLater') }}</button>
		</form>
	</AuthShell>
</template>
<script setup>
const { t } = useI18n()
const { $auth } = useNuxtApp()
const route = useRoute()
const { documentPath, busy, error, run, result, signedIn, registerPasskey } = useAuthFlow()
const keyName = ref('')
const checking = ref(true)
onMounted(async () => {
	try {
		const session = result(await $auth.getSession())
		if (!session?.user) return await navigateTo({ path: '/login', query: { document: route.query.document } }, { replace: true })
		const keys = result(await $auth.passkey.listUserPasskeys())
		if (keys?.length) return await navigateTo(documentPath(), { replace: true })
	} catch { error.value = 'authFailed' }
	finally { checking.value = false }
})
</script>
