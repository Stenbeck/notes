<template>
	<div class="grid gap-3 sm:gap-4" :class="[inline ? 'grid-cols-[minmax(0,1fr)_auto] items-center' : 'grid-cols-1 items-start', 'sm:grid-cols-[minmax(0,1fr)_var(--settings-action-width)]']">
		<div class="min-w-0">
			<h3 class="text-[14px] font-medium leading-5"><label v-if="controlId" :for="controlId" class="cursor-pointer">{{ title }}</label><template v-else>{{ title }}</template></h3>
			<p v-if="description" class="mt-1 text-[14px] leading-5 text-(--muted)">{{ description }}</p>
		</div>
		<div class="grid gap-2"><slot /></div>
	</div>
</template>
<script setup>
defineProps({ title: String, description: String, inline: Boolean, controlId: String })
</script>
