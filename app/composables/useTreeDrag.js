import { descendants, childrenOf } from '../../shared/utils/structure.js'

export const useTreeDrag = () => {
	const app = useNuxtApp()
	if (app._treeDrag) return app._treeDrag
	const { state, move } = useNotes()
	let sourceId, excluded, target, position, marker
	let active = false
	let native = false
	let pointer = { x: 0, y: 0 }
	let startPoint, holdTimer, expandTimer, expandId, frame, lastFrame, scrollContainer

	const clearMarker = () => {
		marker?.removeAttribute('data-drop-position')
		marker = null
		target = undefined
	}
	const cancel = () => {
		active = false
		clearTimeout(holdTimer)
		clearTimeout(expandTimer)
		expandId = null
		cancelAnimationFrame(frame)
		lastFrame = null
		scrollContainer = null
		clearMarker()
		window.removeEventListener('dragover', nativeOver, true)
		window.removeEventListener('drop', nativeDrop, true)
		window.removeEventListener('pointermove', pointerMove)
		window.removeEventListener('pointerup', pointerEnd)
		window.removeEventListener('pointercancel', cancel)
		window.removeEventListener('keydown', escape)
		window.removeEventListener('blur', cancel)
	}
	const escape = (event) => { if (event.key === 'Escape') cancel() }
	const updateTarget = () => {
		const source = state.value.workspace.nodes[sourceId]
		if (source?.status !== 'active') { cancel(); return }
		const hit = document.elementFromPoint(pointer.x, pointer.y)
		const branch = hit?.closest('[data-tree-branch]')
		const row = hit?.closest('[data-drop-id]') || branch?.querySelector(':scope > [data-drop-id]')
		const id = row?.dataset.dropId
		const node = state.value.workspace.nodes[id]
		let nextPosition
		if (row && id !== undefined && !excluded.has(id) && (node || id === '')) {
			const rect = row.getBoundingClientRect()
			const fraction = (pointer.y - rect.top) / rect.height
			if (!node) {
				if (source.kind !== 'project') nextPosition = 'inside'
			} else if (source.kind === 'project') {
				nextPosition = fraction < 0.5 ? 'before' : 'after'
			} else if (node.kind === 'project') {
				nextPosition = 'inside'
			} else {
				nextPosition = fraction < 0.35 ? 'before' : fraction > 0.65 ? 'after' : 'inside'
			}
		}
		if (!nextPosition) {
			clearMarker()
		} else if (marker !== row || position !== nextPosition) {
			clearMarker()
			target = id
			position = nextPosition
			marker = row
			row.dataset.dropPosition = position
		}
		const nextExpand = target && position === 'inside' ? target : null
		if (nextExpand !== expandId) {
			clearTimeout(expandTimer)
			expandId = nextExpand
			if (nextExpand) expandTimer = setTimeout(() => {
				if (active && !state.value.expanded.includes(nextExpand) && childrenOf(state.value.workspace, nextExpand).length) {
					state.value.expanded.push(nextExpand)
				}
			}, 650)
		}
	}
	const tick = (time) => {
		if (!active) return
		const elapsed = Math.min(time - (lastFrame || time), 40)
		lastFrame = time
		const scroll = scrollContainer
		if (scroll) {
			const rect = scroll.getBoundingClientRect()
			const edge = Math.min(48, rect.height / 4)
			if (pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom) {
				const speed = pointer.y < rect.top + edge ? -(rect.top + edge - pointer.y) / edge
					: pointer.y > rect.bottom - edge ? (pointer.y - rect.bottom + edge) / edge : 0
				scroll.scrollTop += speed * 600 * elapsed / 1000
			}
		}
		updateTarget()
		if (active) frame = requestAnimationFrame(tick)
	}
	const activate = (id) => {
		if (state.value.workspace.nodes[id]?.status !== 'active') return false
		sourceId = id
		excluded = new Set([id, ...descendants(state.value.workspace, id)])
		active = true
		scrollContainer = document.querySelector('[data-project-scroll]')
		window.addEventListener('keydown', escape)
		window.addEventListener('blur', cancel)
		frame = requestAnimationFrame(tick)
		return true
	}
	const finish = async () => {
		updateTarget()
		const destination = target
		const placement = position
		const id = sourceId
		cancel()
		if (destination === undefined) return
		const node = state.value.workspace.nodes[destination]
		const inside = placement === 'inside'
		try {
			await move(id, inside ? node?.id || null : node.parentId || null,
				inside ? undefined : node.order + (placement === 'after' ? 1 : 0))
		} catch (error) {
			state.value.error = error.code || 'serverError'
		}
	}
	const nativeOver = (event) => {
		if (!active || !native) return
		pointer = { x: event.clientX, y: event.clientY }
		updateTarget()
		if (event.target.closest?.('aside')) {
			event.preventDefault()
			event.stopPropagation()
			event.dataTransfer.dropEffect = target === undefined ? 'none' : 'move'
		}
	}
	const nativeDrop = (event) => {
		if (!active || !native) return
		pointer = { x: event.clientX, y: event.clientY }
		if (!event.target.closest?.('aside')) { cancel(); return }
		event.preventDefault()
		event.stopPropagation()
		void finish()
	}
	const beginNative = (event) => {
		const id = event.dataTransfer?.getData('text/notes-id')
		if (!id) return
		cancel()
		native = true
		pointer = { x: event.clientX, y: event.clientY }
		if (!activate(id)) return
		window.addEventListener('dragover', nativeOver, true)
		window.addEventListener('drop', nativeDrop, true)
	}
	const pointerMove = (event) => {
		if (!active) {
			if (Math.abs(event.clientX - startPoint.x) + Math.abs(event.clientY - startPoint.y) > 12) cancel()
			return
		}
		event.preventDefault()
		pointer = { x: event.clientX, y: event.clientY }
		updateTarget()
	}
	const pointerEnd = (event) => {
		if (!active) { cancel(); return }
		event.preventDefault()
		pointer = { x: event.clientX, y: event.clientY }
		void finish()
	}
	const start = (event, node) => {
		if (event.pointerType !== 'touch') return
		cancel()
		native = false
		startPoint = { x: event.clientX, y: event.clientY }
		pointer = startPoint
		holdTimer = setTimeout(() => {
			if (activate(node.id) && window.innerWidth < 768) state.value.mobile = true
		}, 450)
		window.addEventListener('pointermove', pointerMove, { passive: false })
		window.addEventListener('pointerup', pointerEnd, { once: true })
		window.addEventListener('pointercancel', cancel, { once: true })
	}
	app._treeDrag = { start, beginNative, cancel }
	return app._treeDrag
}
