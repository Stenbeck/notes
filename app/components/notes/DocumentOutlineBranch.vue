<template>
	<ul :class="{ 'ms-3 border-s border-(--line) ps-1.5 text-(--muted)': nested }">
		<li v-for="entry in entries" :key="entry.position" :data-outline-section="entry.position">
			<button type="button" class="block min-h-8.5 w-full truncate rounded px-1.5 py-1 text-left hover:bg-(--soft)"
				:title="entry.title" :draggable="draggable" @click="emit('jump', entry.position)">
				{{ entry.title }}
			</button>
			<DocumentOutlineBranch v-if="entry.children.length" :entries="entry.children" nested :draggable="draggable" @jump="emit('jump', $event)" />
		</li>
	</ul>
</template>

<script setup>
defineProps({ entries: { type: Array, required: true }, nested: Boolean, draggable: Boolean })
const emit = defineEmits(['jump'])
</script>
