<template>
	<AuthShell :title="t('setup')" :description="t('setupHelp')">
		<p v-if="checking" role="status" class="text-[14px] text-(--muted)">{{ t('authChecking') }}</p>
		<form v-else-if="!verifying" class="space-y-4" @submit.prevent="begin">
			<label class="block text-[14px]">{{ t('setupToken') }}<input v-model="values.token" type="password" required :disabled="busy" autocomplete="off" class="mt-1.5 min-h-[44px] w-full rounded-md border border-(--line) bg-(--surface) px-3 py-2.5" /></label>
			<label class="block text-[14px]">{{ t('name') }}<input v-model="values.name" required :disabled="busy" autocomplete="name" class="mt-1.5 min-h-[44px] w-full rounded-md border border-(--line) bg-(--surface) px-3 py-2.5" /></label>
			<label class="block text-[14px]">{{ t('email') }}<input v-model="values.email" type="email" required :disabled="busy" autocomplete="email" class="mt-1.5 min-h-[44px] w-full rounded-md border border-(--line) bg-(--surface) px-3 py-2.5" /></label>
			<p v-if="notice" role="status" class="rounded-md bg-(--soft) px-3 py-2.5 text-[14px] leading-6 text-(--accent)">{{ t(notice) }}</p>
			<AuthButton type="submit" :loading="busy">{{ t('verifyEmail') }}</AuthButton>
		</form>
		<p v-if="error" role="alert" class="error-message mt-4 text-[14px] leading-6">{{ t(error) }}</p>
		<template #footer><p class="mt-6 text-center text-[14px] text-(--muted)"><NuxtLink to="/login" class="underline underline-offset-4 hover:text-(--accent)">{{ t('backToLogin') }}</NuxtLink></p></template>
	</AuthShell>
</template>
<script setup>
const { t } = useI18n()
const { values, checking, verifying, busy, error, notice, begin } = useSetupFlow()
</script>
