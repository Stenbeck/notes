<template>
	<main class="mx-auto max-w-4xl px-5 py-8">
		<header class="mb-12 border-b border-(--line) pb-3">
			<a :href="preview?.origin || '/'" class="inline-block text-2xl font-semibold tracking-tight">notes<span class="text-(--accent)">.</span></a>
		</header>
		<p v-if="error" class="error-message" role="alert">{{ t(error) }}</p>
		<form v-if="data?.locked" class="mx-auto max-w-sm space-y-4 py-8" @submit.prevent="unlock">
			<h1>{{ t('protected') }}</h1>
			<label class="block"
				>{{ t('password')
				}}<input
					v-model="password"
					type="password"
					required
					class="mt-2 w-full rounded border border-(--line) bg-(--surface) p-2" /></label
			><div class="flex justify-end"><AppButton type="submit" primary>{{ t('unlock') }}</AppButton></div>
		</form>
		<div v-else-if="data">
			<button v-if="child" class="mb-4 text-(--accent)" @click="selectChild(null)">
				← {{ data.root.title }}
			</button>
			<h1 class="mb-4">{{ data.node.title }}</h1>
			<div v-if="data.document" class="prose" v-html="documentHTML" />
			<section v-if="data.children.length" class="mt-6 border-t border-(--line) pt-4">
				<h2 class="mb-2">{{ t('children') }}</h2>
				<button
					v-for="node in data.children"
					:key="node.id"
					class="block w-full border-b border-(--line) p-2 text-left hover:bg-(--soft)"
					@click="selectChild(node.id)"
				>
					{{ node.title }}
				</button>
			</section>
		</div>
	</main>
</template>
<script setup>
const { t, data, password, error, child, documentHTML, selectChild, unlock } = usePublicDocument()
const route = useRoute()
const { data: preview } = await useAsyncData(
	() => `public-preview:${route.fullPath.split('#')[0]}`,
	async () => {
		try {
			const response = await $fetch(`/api/public-preview/${encodeURIComponent(route.params.slug)}`, {
				query: { document: route.query.document }
			})
			return response.data || {}
		} catch {
			return {}
		}
	}
)
const shareTitle = computed(() => preview.value?.title || (preview.value?.locked ? t('protected') : 'Notes'))
const description = computed(() => t(preview.value?.locked ? 'protectedShareDescription' : 'publicShareDescription'))
const shareURL = computed(() => preview.value?.origin && new URL(route.fullPath.split('#')[0], preview.value.origin).href)
const shareImage = computed(() => preview.value?.origin && new URL('/share-preview.png', preview.value.origin).href)

useHead(() => ({
	htmlAttrs: {
		'data-theme': preview.value?.theme || 'notes',
		'data-appearance': preview.value?.appearance || 'system'
	}
}))
useSeoMeta({
	title: () => shareTitle.value === 'Notes' ? 'Notes' : `${shareTitle.value} · Notes`,
	robots: 'noindex',
	description,
	ogSiteName: 'Notes',
	ogType: 'article',
	ogTitle: shareTitle,
	ogDescription: description,
	ogUrl: shareURL,
	ogImage: shareImage,
	ogImageWidth: 1200,
	ogImageHeight: 630,
	ogImageAlt: 'Notes',
	twitterCard: 'summary_large_image'
})
</script>
