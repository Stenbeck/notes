<template>
	<AuthShell :title="t('mcpConnectTitle')" :description="t('mcpConnectDescription')">
		<div class="space-y-5 text-[14px] text-(--ink)">
			<template v-if="consent">
				<div class="space-y-2">
					<p class="font-semibold wrap-break-word">{{ consent.client.name }}</p>
					<p class="wrap-break-word text-(--muted)">{{ t('mcpConnectDestination') }}: {{ consent.client.redirectUri }}</p>
				</div>
				<template v-if="consent.tokens.length">
					<div class="space-y-2">
						<p>{{ t('mcpConnectToken') }}</p>
						<AppSelect v-model="tokenId" :disabled="busy" :label="t('mcpConnectToken')" :options="consent.tokens.map(token => ({ value: token.id, label: token.name }))" />
					</div>
					<div v-if="selected" class="space-y-2 rounded border border-(--line) p-3">
						<p class="font-medium">{{ t(selected.permission === 'write' ? 'mcpConnectWrite' : 'mcpConnectRead') }}</p>
						<ul class="list-inside list-disc"><li v-for="project in selected.projects" :key="project.id" class="wrap-break-word">{{ project.title }}</li></ul>
					</div>
					<p class="text-(--muted)">{{ t('mcpConnectRevoke') }}</p>
					<AuthButton :loading="busy" :disabled="!selected" @click="decide(true)">{{ t('mcpConnectAllow') }}</AuthButton>
				</template>
				<template v-else>
					<p>{{ t('mcpConnectNoTokens') }}</p>
					<a href="/" target="_blank" rel="noopener noreferrer" class="text-(--accent) underline">{{ t('mcpConnectOpenNotes') }}</a>
					<AuthButton secondary :loading="busy" @click="load">{{ t('mcpConnectRetry') }}</AuthButton>
				</template>
				<AuthButton secondary :disabled="busy" @click="decide(false)">{{ t('cancel') }}</AuthButton>
			</template>
			<template v-if="error === 'unauthorized'">
				<p>{{ t('mcpConnectSignIn') }}</p>
				<a href="/login" target="_blank" rel="noopener noreferrer" class="block text-(--accent) underline">{{ t('mcpConnectLogin') }}</a>
				<AuthButton :loading="busy" @click="load">{{ t('mcpConnectRetry') }}</AuthButton>
			</template>
			<template v-else-if="error">
				<p role="alert">{{ t(error) }}</p>
				<AuthButton secondary :loading="busy" @click="load">{{ t('mcpConnectRetry') }}</AuthButton>
			</template>
			<p v-else-if="busy && !consent" role="status">{{ t('mcpConnectLoading') }}</p>
		</div>
	</AuthShell>
</template>
<script setup>
const { t } = useI18n()
const { consent, tokenId, selected, busy, error, load, decide } = useMcpConsent()
useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>
