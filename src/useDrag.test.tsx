import { renderHook } from '@testing-library/react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useDrag } from './useDrag'

// jsdom performs no layout, so every element reports scroll/client metrics of 0
// and `findScrollableAncestor` would never see a scrollable subtree. Stamp the
// metrics (and a working scrollTop accessor) directly onto the element.
const makeVerticallyScrollable = (el: HTMLElement) => {
	el.style.overflowY = 'auto'
	Object.defineProperty(el, 'scrollHeight', { value: 1000, configurable: true })
	Object.defineProperty(el, 'clientHeight', { value: 100, configurable: true })
	Object.defineProperty(el, 'scrollWidth', { value: 100, configurable: true })
	Object.defineProperty(el, 'clientWidth', { value: 100, configurable: true })
	let scrollTop = 0
	Object.defineProperty(el, 'scrollTop', {
		configurable: true,
		get: () => scrollTop,
		set: (value: number) => {
			scrollTop = value
		},
	})
	let scrollLeft = 0
	Object.defineProperty(el, 'scrollLeft', {
		configurable: true,
		get: () => scrollLeft,
		set: (value: number) => {
			scrollLeft = value
		},
	})
}

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
})
