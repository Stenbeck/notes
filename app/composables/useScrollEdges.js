export const useScrollEdges = (viewport, content) => {
	const above = ref(false)
	const below = ref(false)
	let observer
	const update = () => {
		const element = viewport.value
		if (!element) return
		above.value = element.scrollTop > 1
		below.value = element.scrollHeight - element.clientHeight - element.scrollTop > 1
	}
	watch([viewport, content], ([element, inner]) => {
		observer?.disconnect()
		if (!element) return
		observer ||= new ResizeObserver(update)
		observer.observe(element)
		if (inner) observer.observe(inner)
		update()
	}, { flush: 'post' })
	onBeforeUnmount(() => observer?.disconnect())
	return { above, below, update }
}
