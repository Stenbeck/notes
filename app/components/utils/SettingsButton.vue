<template>
	<AppButton :tag="tag" :type="type" :icon-only="iconOnly" :primary="primary" :danger="danger"
		:class="!iconOnly && !compact ? 'w-full sm:w-(--settings-action-width)' : undefined"><slot /></AppButton>
</template>
<script setup>
defineProps({ tag: { type: String, default: 'button' }, type: { type: String, default: 'button' }, iconOnly: Boolean, compact: Boolean, primary: Boolean, danger: Boolean })
</script>
