<template>
	<main data-auth-screen class="flex min-h-dvh items-center justify-center bg-(--paper) px-[max(20px,env(safe-area-inset-left),env(safe-area-inset-right))] py-[max(40px,env(safe-area-inset-top),env(safe-area-inset-bottom))] sm:py-14">
		<div class="w-full max-w-[440px]">
			<section :aria-labelledby="title ? titleId : undefined" class="rounded-xl border border-(--line) bg-(--surface) p-6 shadow-sm sm:p-8">
				<header class="mb-7">
					<NuxtLink to="/" class="inline-block text-[28px] font-semibold tracking-tight text-(--ink)" :class="title ? 'mb-6' : ''">notes<span class="text-(--accent)">.</span></NuxtLink>
					<h1 v-if="title" :id="titleId" class="text-(--ink)">{{ title }}</h1>
					<p v-if="description" class="mt-3 text-[14px] leading-6 text-(--muted)">{{ description }}</p>
				</header>
				<slot />
			</section>
			<slot name="footer" />
		</div>
	</main>
</template>
<script setup>
defineProps({ title: String, description: String })
const titleId = useId()
</script>
