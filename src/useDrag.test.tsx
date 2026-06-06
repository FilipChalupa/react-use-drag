import { renderHook } from '@testing-library/react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useDrag } from './useDrag'

// jsdom performs no layout, so every element reports scroll/client metrics of 0
// and `findScrollableAncestor` would never see a scrollable subtree. Stamp the
// metrics (and working scroll accessors that clamp like a real element) directly
// onto the element.
const stampScrollable = (
	el: HTMLElement,
	metrics: {
		scrollWidth: number
		clientWidth: number
		scrollHeight: number
		clientHeight: number
		overflowX?: string
		overflowY?: string
	},
) => {
	if (metrics.overflowX) el.style.overflowX = metrics.overflowX
	if (metrics.overflowY) el.style.overflowY = metrics.overflowY
	for (const key of [
		'scrollWidth',
		'clientWidth',
		'scrollHeight',
		'clientHeight',
	] as const) {
		Object.defineProperty(el, key, { value: metrics[key], configurable: true })
	}
	const maxTop = Math.max(0, metrics.scrollHeight - metrics.clientHeight)
	const maxLeft = Math.max(0, metrics.scrollWidth - metrics.clientWidth)
	let scrollTop = 0
	Object.defineProperty(el, 'scrollTop', {
		configurable: true,
		get: () => scrollTop,
		// Clamp the way a real element does, so a no-op write to a non-scrollable
		// axis stays at 0 instead of going negative.
		set: (value: number) => {
			scrollTop = Math.max(0, Math.min(maxTop, value))
		},
	})
	let scrollLeft = 0
	Object.defineProperty(el, 'scrollLeft', {
		configurable: true,
		get: () => scrollLeft,
		set: (value: number) => {
			scrollLeft = Math.max(0, Math.min(maxLeft, value))
		},
	})
}

const makeVerticallyScrollable = (el: HTMLElement) =>
	stampScrollable(el, {
		scrollWidth: 100,
		clientWidth: 100,
		scrollHeight: 1000,
		clientHeight: 100,
		overflowY: 'auto',
	})

// Minimal stand-in for the bits of a React PointerEvent the hook touches.
const pointerEvent = (
	currentTarget: HTMLElement,
	target: HTMLElement,
	props: {
		pointerId: number
		pointerType: 'mouse' | 'touch' | 'pen'
		clientX: number
		clientY: number
		buttons?: number
	},
): ReactPointerEvent<HTMLElement> =>
	({
		...props,
		buttons: props.buttons ?? 1,
		target,
		currentTarget,
		preventDefault: () => {},
	}) as unknown as ReactPointerEvent<HTMLElement>

describe('useDrag', () => {
	it('drives manual scroll when shouldStart returns false over a scrollable subtree', () => {
		// Drag root with a scrollable child inside it.
		const root = document.createElement('div')
		const scrollEl = document.createElement('div')
		root.appendChild(scrollEl)
		document.body.appendChild(root)
		makeVerticallyScrollable(scrollEl)
		// Pointer capture isn't implemented in jsdom.
		root.setPointerCapture = vi.fn()
		root.releasePointerCapture = vi.fn()

		// shouldStart always defers — the consumer decides this isn't a drag, and
		// expects the hook to take the scroll instead of releasing to the browser.
		const shouldStart = vi.fn(() => false)
		const { result } = renderHook(() =>
			useDrag({ onRelativePositionChange: () => {}, shouldStart }),
		)
		const { onPointerDown, onPointerMove } = result.current.elementProps

		const pointerId = 1
		onPointerDown(
			pointerEvent(root, scrollEl, {
				pointerId,
				pointerType: 'touch',
				clientX: 50,
				clientY: 200,
			}),
		)
		// First move past the arming threshold (vertical, finger up → scroll down).
		onPointerMove(
			pointerEvent(root, scrollEl, {
				pointerId,
				pointerType: 'touch',
				clientX: 50,
				clientY: 140,
			}),
		)
		// Continued move while in scroll mode.
		onPointerMove(
			pointerEvent(root, scrollEl, {
				pointerId,
				pointerType: 'touch',
				clientX: 50,
				clientY: 100,
			}),
		)

		expect(shouldStart).toHaveBeenCalled()
		// Hook drove the scroll itself…
		expect(scrollEl.scrollTop).toBeGreaterThan(0)
		// …and never promoted the gesture to a drag.
		expect(result.current.state).toBe('resting')

		document.body.removeChild(root)
	})

	// Cross-axis carousel: scrollable on X only. The 17px phantom Y range below
	// (scrollHeight − clientHeight === tolerance) plus a quirk-coupled
	// `overflow-y: auto` is exactly what used to make a horizontal strip look
	// Y-scrollable and steal a vertical gesture.
	const buildCarouselCase = () => {
		const root = document.createElement('div')
		const carousel = document.createElement('div')
		root.appendChild(carousel)
		document.body.appendChild(root)
		stampScrollable(carousel, {
			scrollWidth: 1000,
			clientWidth: 100,
			scrollHeight: 117, // 17px phantom range from a reserved horizontal scrollbar
			clientHeight: 100,
			overflowX: 'auto',
			overflowY: 'auto', // browser couples this to `auto` even when visible
		})
		const setPointerCapture = vi.fn()
		root.setPointerCapture = setPointerCapture
		root.releasePointerCapture = vi.fn()
		return { root, carousel, setPointerCapture }
	}

	it('does not claim a vertical gesture over a horizontal-only carousel', () => {
		const { root, carousel, setPointerCapture } = buildCarouselCase()
		// shouldStart defers — without axis-aware resolution the hook would have
		// dead-scrolled the carousel's scrollTop and captured the pointer.
		const { result } = renderHook(() =>
			useDrag({ onRelativePositionChange: () => {}, shouldStart: () => false }),
		)
		const { onPointerDown, onPointerMove } = result.current.elementProps

		const pointerId = 7
		onPointerDown(
			pointerEvent(root, carousel, {
				pointerId,
				pointerType: 'touch',
				clientX: 50,
				clientY: 200,
			}),
		)
		onPointerMove(
			pointerEvent(root, carousel, {
				pointerId,
				pointerType: 'touch',
				clientX: 50,
				clientY: 130, // vertical
			}),
		)

		// No scroll target on the Y axis → release without claiming, so an outer
		// useDrag can take the gesture.
		expect(setPointerCapture).not.toHaveBeenCalled()
		expect(carousel.scrollTop).toBe(0)
		expect(result.current.state).toBe('resting')

		document.body.removeChild(root)
	})

	it('drives the carousel for a horizontal gesture over it', () => {
		const { root, carousel, setPointerCapture } = buildCarouselCase()
		const { result } = renderHook(() =>
			useDrag({ onRelativePositionChange: () => {}, shouldStart: () => false }),
		)
		const { onPointerDown, onPointerMove } = result.current.elementProps

		const pointerId = 8
		onPointerDown(
			pointerEvent(root, carousel, {
				pointerId,
				pointerType: 'touch',
				clientX: 200,
				clientY: 50,
			}),
		)
		onPointerMove(
			pointerEvent(root, carousel, {
				pointerId,
				pointerType: 'touch',
				clientX: 130, // horizontal, finger left → scroll right
				clientY: 50,
			}),
		)

		// The X axis is genuinely scrollable → hook claims and scrolls it.
		expect(setPointerCapture).toHaveBeenCalled()
		expect(carousel.scrollLeft).toBeGreaterThan(0)
		expect(result.current.state).toBe('resting')

		document.body.removeChild(root)
	})
})
