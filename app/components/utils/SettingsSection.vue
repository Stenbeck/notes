<template>
	<section class="space-y-4" :class="{ 'border-t border-(--line) pt-5': divided }">
		<h2 v-if="title" class="text-[14px] font-semibold leading-5">{{ title }}</h2>
		<slot />
	</section>
</template>
<script setup>
defineProps({ title: String, divided: { type: Boolean, default: true } })
</script>
