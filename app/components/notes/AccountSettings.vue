<template>
	<div class="space-y-5">
		<SettingsSection :divided="false" :aria-label="t('account')">
			<ProfileImage />
			<form class="space-y-2" @submit.prevent="saveName">
				<label for="account-name" class="block leading-5">{{ t('name') }}</label>
				<div data-account-name-row class="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_var(--settings-action-width)] items-end gap-2">
					<SettingsInput id="account-name" v-model="name" required maxlength="100" autocomplete="name" :disabled="busy" />
					<SettingsButton type="submit" primary :disabled="busy || !name.trim() || name.trim() === state.user?.name">{{ t('saveName') }}</SettingsButton>
				</div>
			</form>
			<form class="space-y-2" @submit.prevent="changeEmail">
				<label for="account-email" class="block leading-5">{{ t('email') }}</label>
				<div data-account-email-row class="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_var(--settings-action-width)] items-end gap-2">
					<SettingsInput id="account-email" v-model="email" required type="email" autocomplete="email" :disabled="busy" aria-describedby="account-email-help" />
					<SettingsButton type="submit" primary :disabled="busy || !email.trim() || email.trim().toLowerCase() === state.user?.email">{{ t('changeEmail') }}</SettingsButton>
				</div>
				<p id="account-email-help" class="text-[14px] leading-5 text-(--muted)">{{ t('emailChangeHelp') }}</p>
			</form>
		</SettingsSection>
		<SettingsSection :title="t('passkeys')">
			<p v-if="!passkeys.length && !busy" class="text-(--muted)">{{ t('noPasskeys') }}</p>
			<div v-if="passkeys.length" class="divide-y divide-(--line) rounded-md border border-(--line) bg-(--paper)">
				<div v-for="key in passkeys" :key="key.id" data-passkey-row class="p-3">
					<form v-if="editingKey === key.id" class="space-y-2" @submit.prevent="saveKey(key)">
						<label :for="`passkey-${key.id}`" class="block text-(--muted)">{{ t('passkeyName') }}</label>
						<div class="flex items-center gap-2">
							<SettingsInput :id="`passkey-${key.id}`" v-model="editedName" required maxlength="100" :disabled="busy" />
							<SettingsButton icon-only :disabled="busy" :aria-label="t('cancel')" :title="t('cancel')" @click="editingKey = null"><LucideX class="size-4" /></SettingsButton>
							<SettingsButton type="submit" primary icon-only :disabled="busy || !editedName.trim()" :aria-label="t('save')" :title="t('save')"><LucideCheck class="size-4" /></SettingsButton>
						</div>
					</form>
					<div v-else class="flex items-center gap-3">
						<LucideKeyRound class="size-5 shrink-0 text-(--muted)" />
						<div class="min-w-0 flex-1"><p class="truncate font-medium">{{ key.name }}</p><p class="mt-1 text-[14px] leading-5 text-(--muted)">{{ t('passkeyCreated', { date: formatDateTime(key.createdAt, state.workspace.preferences) }) }}</p></div>
						<div class="flex shrink-0 gap-1">
							<SettingsButton icon-only :disabled="busy" :aria-label="t('renamePasskey', { name: key.name })" :title="t('renamePasskey', { name: key.name })" @click="editKey(key)"><LucidePencil class="size-4" /></SettingsButton>
							<SettingsButton icon-only danger :disabled="busy" :aria-label="t('removePasskey', { name: key.name })" :title="t('removePasskey', { name: key.name })" @click="removeKey(key)"><LucideTrash2 class="size-4" /></SettingsButton>
						</div>
					</div>
				</div>
			</div>
			<form class="space-y-2" @submit.prevent="addKey">
				<label for="account-new-passkey" class="block leading-5">{{ t('newPasskeyName') }}</label>
				<div class="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_var(--settings-action-width)] gap-2">
					<SettingsInput id="account-new-passkey" v-model="keyName" required :placeholder="t('passkeyNamePlaceholder')" maxlength="100" :disabled="busy" />
					<SettingsButton type="submit" primary :disabled="busy || !keyName.trim()" :aria-label="t('addPasskey')">{{ t('add') }}</SettingsButton>
				</div>
			</form>
		</SettingsSection>
		<p v-if="notice" role="status" class="text-(--accent)">{{ t(notice) }}</p>
		<p v-if="error" role="alert" class="error-message">{{ t(error) }}<NuxtLink v-if="error === 'freshLoginRequired'" to="/login" class="ml-2 underline">{{ t('login') }}</NuxtLink></p>
	</div>
</template>
<script setup>
import { formatDateTime } from '../../../shared/utils/dateTime.js'
const { t } = useI18n()
const { state, name, email, keyName, passkeys, busy, error, notice, saveName, changeEmail, addKey, renameKey, removeKey } = useAccountSettings()
const editingKey = ref(null)
const editedName = ref('')
const editKey = (key) => {
	editingKey.value = key.id
	editedName.value = key.name
}
const saveKey = async (key) => {
	await renameKey({ ...key, name: editedName.value })
	if (!error.value) editingKey.value = null
}
</script>

