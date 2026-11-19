<template>
	<ClientOnly
		><NotesShell /><template #fallback><p class="p-5">Notes…</p></template></ClientOnly
	>
</template>

<script setup>
definePageMeta({ key: 'workspace' })
</script>
