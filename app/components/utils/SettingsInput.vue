<template>
	<input v-model="model" class="h-[40px] min-w-0 w-full rounded-md border border-(--line) bg-(--surface) px-3 text-[14px] leading-5 disabled:opacity-50" />
</template>
<script setup>
const model = defineModel({ type: String, default: '' })
</script>
