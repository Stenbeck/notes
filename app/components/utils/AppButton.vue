<template>
	<component :is="tag" :type="tag === 'button' ? type : undefined"
		class="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border text-[14px] leading-5 transition-colors disabled:cursor-default disabled:opacity-45"
		:class="[comfortable ? 'min-h-[44px] py-2.5' : 'h-[40px]', iconOnly ? 'w-[40px] px-0' : 'px-3', primary ? (danger ? 'border-(--danger) bg-(--danger) text-white hover:opacity-90' : 'border-(--accent) bg-(--accent) text-(--on-accent) hover:opacity-90') : danger ? 'border-(--line) bg-(--surface) text-(--status-error) hover:border-(--status-error) hover:bg-(--danger-soft)' : 'border-(--line) bg-(--surface) text-(--ink) hover:bg-(--soft)']"><slot /></component>
</template>
<script setup>
defineProps({ tag: { type: [String, Object], default: 'button' }, type: { type: String, default: 'button' }, comfortable: Boolean, iconOnly: Boolean, primary: Boolean, danger: Boolean })
</script>
