<template>
	<AppButton
		:type="type"
		:disabled="disabled || loading"
		:aria-busy="loading || undefined"
		:primary="!secondary"
		comfortable
		class="w-full font-medium">
		<LucideLoaderCircle v-if="loading" class="size-4 animate-spin" aria-hidden="true" />
		<slot v-else name="icon" />
		<slot />
	</AppButton>
</template>
<script setup>
defineProps({ type: { type: String, default: 'button' }, loading: Boolean, disabled: Boolean, secondary: Boolean })
</script>
