import type { Position } from './useDrag'

/**
 * Walks up from `start` to `bound` (inclusive) looking for the first element
 * that is currently scrollable on either axis. An element counts as scrollable
 * when it has `overflow-x` / `overflow-y` of `auto` or `scroll` AND its
 * scroll{Width,Height} actually exceeds its client{Width,Height}.
 */
export const findScrollableAncestor = (
	start: EventTarget | null,
	bound: Element,
): Element | null => {
	let element = start instanceof Element ? start : null
	while (element) {
		const style = window.getComputedStyle(element)
		const scrollableY =
			element.scrollHeight > element.clientHeight &&
			(style.overflowY === 'auto' || style.overflowY === 'scroll')
		const scrollableX =
			element.scrollWidth > element.clientWidth &&
			(style.overflowX === 'auto' || style.overflowX === 'scroll')
		if (scrollableX || scrollableY) {
			return element
		}
		if (element === bound) {
			return null
		}
		element = element.parentElement
	}
	return null
}

/**
 * Default arming verdict when the consumer doesn't supply `shouldStart`. Picks
 * drag when the scroll container has nowhere left to scroll in the gesture's
 * direction (rubber-band edges), otherwise returns `false` so the move handler
 * enters scroll mode.
 */
export const evaluateScrollEdgeAccept = (
	delta: Position,
	scrollEl: Element | null,
): boolean => {
	if (!scrollEl) {
		return true
	}
	const canScrollUp = scrollEl.scrollTop > 0
	const canScrollDown =
		scrollEl.scrollTop < scrollEl.scrollHeight - scrollEl.clientHeight - 1
	const canScrollLeft = scrollEl.scrollLeft > 0
	const canScrollRight =
		scrollEl.scrollLeft < scrollEl.scrollWidth - scrollEl.clientWidth - 1
	if (delta.y > 0 && canScrollUp) {
		return false
	}
	if (delta.y < 0 && canScrollDown) {
		return false
	}
	if (delta.x > 0 && canScrollLeft) {
		return false
	}
	if (delta.x < 0 && canScrollRight) {
		return false
	}
	return true
}
