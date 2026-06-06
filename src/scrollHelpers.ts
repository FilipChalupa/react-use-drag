import type { Position } from './useDrag'

// A scroll range that exists only because of a reserved scrollbar isn't real:
// there's nowhere to actually scroll. Two browser quirks manufacture such
// phantom overflow on the axis perpendicular to a single-axis scroller:
//   1. Computed-overflow coupling — setting `overflow-x: scroll`/`auto` while
//      the other axis stays `visible` makes the *computed* `overflow-y` resolve
//      to `auto` too (and vice versa). So a purely horizontal strip reports
//      `overflowY === 'auto'` and passes the overflow check on the Y axis.
//   2. Scrollbar reservation — a classic (non-overlay) scrollbar shrinks the
//      perpendicular client size, so an element whose content merely fills its
//      box reports `scroll{Width,Height} - client{Width,Height}` of roughly the
//      scrollbar thickness even though it can't scroll that way.
// Requiring the scrollable range to exceed a classic scrollbar's thickness
// rejects both. Overlay scrollbars (iOS/macOS default) reserve no space, so they
// never produce a phantom range to begin with — this only ever filters the
// classic/`scrollbar-gutter` case.
const scrollbarThicknessTolerancePixels = 17

const isScrollableOnAxis = (element: Element, axis: 'x' | 'y'): boolean => {
	const style = window.getComputedStyle(element)
	if (axis === 'y') {
		return (
			element.scrollHeight - element.clientHeight >
				scrollbarThicknessTolerancePixels &&
			(style.overflowY === 'auto' || style.overflowY === 'scroll')
		)
	}
	return (
		element.scrollWidth - element.clientWidth >
			scrollbarThicknessTolerancePixels &&
		(style.overflowX === 'auto' || style.overflowX === 'scroll')
	)
}

/**
 * Walks up from `start` to `bound` (inclusive) looking for the first element
 * that is currently scrollable. An element counts as scrollable on an axis when
 * it has that axis's `overflow` set to `auto` or `scroll` AND its real
 * scrollable range on that axis exceeds a scrollbar's thickness (see
 * `isScrollableOnAxis` for why the plain `scrollSize > clientSize` test is too
 * loose).
 *
 * Pass `axis` to constrain the search to a single axis — `'y'` skips
 * horizontal-only scrollers (e.g. a carousel) so a vertical gesture isn't
 * captured by something it can't actually scroll, and `'x'` does the reverse.
 * Omit `axis` for the legacy any-axis behavior.
 */
export const findScrollableAncestor = (
	start: EventTarget | null,
	bound: Element,
	axis?: 'x' | 'y',
): Element | null => {
	let element = start instanceof Element ? start : null
	while (element) {
		const scrollableY = axis !== 'x' && isScrollableOnAxis(element, 'y')
		const scrollableX = axis !== 'y' && isScrollableOnAxis(element, 'x')
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
