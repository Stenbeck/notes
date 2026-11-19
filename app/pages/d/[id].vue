<template><div /></template>
<script setup>
const route = useRoute()
await navigateTo({ path: `/doc/${encodeURIComponent(route.params.id)}` }, { replace: true })
</script>
