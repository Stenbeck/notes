<template>
	<fieldset>
		<legend class="mb-2">{{ t('icon') }}</legend>
		<div class="grid max-h-48 grid-cols-8 gap-1 overflow-y-auto rounded-md border border-(--line) p-2 sm:grid-cols-10">
			<button v-for="icon in projectIcons" :key="icon" type="button" :aria-label="icon" :aria-pressed="model === icon" :title="icon" class="flex aspect-square items-center justify-center rounded-md p-2 hover:bg-(--soft)" :class="model === icon ? 'bg-(--soft) ring-1 ring-(--accent)' : ''" :style="{ color }" @click="model = icon"><AppIcon :name="icon" :size="19" /></button>
		</div>
	</fieldset>
</template>
<script setup>
import { projectIcons } from '../../../shared/utils/icons.js'
defineProps({ color: String })
const model = defineModel()
const { t } = useI18n()
</script>
