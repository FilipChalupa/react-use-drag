import {
	PointerEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react'
import {
	chooseSnapPoint,
	inertiaFrictionPerSecond,
	maximumSnapFrameDeltaSeconds,
	projectInertiaEndpoint,
	settleVelocityThreshold,
	snapDamping,
	snapDistanceThreshold,
	snapStiffness,
} from './coastingMath'
import {
	evaluateScrollEdgeAccept,
	findScrollableAncestor,
} from './scrollHelpers'

export interface Velocity {
	/** Pixels per second. */
	x: number
	/** Pixels per second. */
	y: number
}

export interface Position {
	/** Pixels relative to the drag start position. */
	x: number
	/** Pixels relative to the drag start position. */
	y: number
}

export interface PositionWithVelocity extends Position {
	/** Current drag velocity in pixels per second. */
	velocity: Velocity
}

export type DragState = 'resting' | 'dragging' | 'coasting'

export interface UseDragOptions {
	/** Called when the position changes during dragging or coasting. Position is relative to the start. */
	onRelativePositionChange: (position: PositionWithVelocity) => void
	/** Optional. Called when the dragging interaction starts. With `shouldStart` it fires only after the gesture is promoted to a drag. */
	onStart?: () => void
	/**
	 * Optional. Called when the interaction fully ends. With `inertia` or `snapPoints`
	 * this fires only after the coasting animation settles. Receives the final
	 * relative position. On cancellation x, y and velocity are 0. The final snap
	 * target is delivered through this callback — `onRelativePositionChange` does
	 * not emit the end position.
	 */
	onEnd?: (position: PositionWithVelocity) => void
	/** Optional. When true, the element keeps moving after release with friction-based deceleration until it settles. */
	inertia?: boolean
	/**
	 * Optional. Snap targets in the same coordinate space as the relative position.
	 * On release, the snap point closest to the inertia projection is chosen. With
	 * `inertia` the position springs to the target absorbing the release velocity;
	 * without `inertia` it teleports there immediately.
	 */
	snapPoints?: Position[]
	/**
	 * Optional escape hatch. Evaluated on the first pointermove past a few-pixel
	 * threshold. Return `true` to take over the gesture as a drag, `false` to
	 * defer it. If a scrollable subtree exists, deferring puts the hook into
	 * scroll mode (it drives `scrollTop`/`scrollLeft` itself with momentum on
	 * release); otherwise the hook releases the pointer.
	 *
	 * When omitted, the hook auto-detects: on `pointerdown` it walks from the
	 * event target up to the drag root looking for a scrollable element. If one
	 * is found and the input is touch/pen, the gesture is held back until the
	 * first move; the verdict picks drag when the scroll container is at its
	 * edge in the gesture's direction, scroll otherwise. Mouse always drags
	 * immediately.
	 *
	 * Set `touch-action: none` on the scrollable element so the browser doesn't
	 * claim the gesture — the hook drives both drag and scroll itself, with
	 * momentum and a dominant-axis lock for diagonal gestures.
	 *
	 * The second argument carries `pointerType` so the consumer can short-
	 * circuit by input mode.
	 */
	shouldStart?: (
		firstMove: Position,
		info: { pointerType: 'mouse' | 'touch' | 'pen' | (string & {}) },
	) => boolean
}

/**
 * Hook to handle drag interactions using Pointer Events.
 *
 * @param options - Configuration options for the drag interaction.
 * @returns An object containing:
 * - `state`: `'resting' | 'dragging' | 'coasting'`. `'coasting'` only occurs while inertia or snap animation runs.
 * - `elementProps`: props to spread onto the draggable element.
 *
 * @example
 * const { elementProps, state } = useDrag({
 *   onRelativePositionChange: ({ x, y, velocity }) => console.log('Offset:', x, y, 'Velocity:', velocity),
 * })
 * return <div {...elementProps} style={{ touchAction: 'none' }} />
 */

const velocityResetDelayInMilliseconds = 100 // ms without movement before velocity drops to zero
const armingMoveThresholdPixels = 5 // minimum movement on either axis before the arming verdict (drag vs scroll) runs

interface CoastingData {
	startTime: number
	startPosition: Position
	startVelocity: Velocity
	lastPosition: Position
	lastVelocity: Velocity
	lastFrameTime: number
	target: Position | null
}

// Module-level singleton for nested-useDrag coordination. When a hook claims
// a gesture (commits to drag or scroll mode), it adds the pointerId here.
// Other hooks observing the same pointer in their arming branch see the claim
// and stand down without requiring any context provider or wrapper component.
// Innermost hooks evaluate first via React's natural pointer-event bubble.
const claimedPointers = new Set<number>()

export const useDrag = (options: UseDragOptions) => {
	const {
		onRelativePositionChange,
		onStart,
		onEnd,
		inertia,
		snapPoints,
		shouldStart,
	} = options
	const [dragState, setDragState] = useState<DragState>('resting')
	const startPosition = useRef({ x: 0, y: 0, scrollX: 0, scrollY: 0 })
	const offsetPositionRef = useRef<Position>({ x: 0, y: 0 })
	const velocityRef = useRef<Velocity>({ x: 0, y: 0 })
	const lastMoveRef = useRef<{ time: number; x: number; y: number } | null>(
		null,
	)
	const velocityResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const animationFrameRef = useRef<number | null>(null)
	const coastingStateRef = useRef<CoastingData | null>(null)
	// Set on pointerdown when arming is in play (either shouldStart is provided
	// or the hook auto-detected a scrollable subtree). Cleared on the first move
	// that either promotes to a drag or decides not to.
	const armingRef = useRef<{
		pointerId: number
		scrollableAncestor: Element | null
	} | null>(null)
	// Set when the hook is taking over native scroll manually (after the arming
	// verdict said "defer to scroll" and there's a scroll container). Each move
	// updates `scrollEl.scrollTop`/`scrollLeft` directly. Scroll velocity is
	// tracked so we can hand off to a coasting animation on release. `lockedAxis`
	// is determined from the dominant component of the gesture at scroll-mode
	// entry; the other axis is then ignored for the rest of the gesture (iOS-
	// style direction lock — minor diagonal drift doesn't pollute the scroll).
	const scrollingStateRef = useRef<{
		pointerId: number
		scrollEl: HTMLElement
		lockedAxis: 'x' | 'y'
		lastClientX: number
		lastClientY: number
		lastTime: number
		velocityX: number
		velocityY: number
		velocityResetTimeout: ReturnType<typeof setTimeout> | null
	} | null>(null)
	// In-flight scroll inertia animation. Mirrors `coastingStateRef` but applies
	// exponential-decay velocity to scrollTop/Left instead of offsetPosition.
	const scrollCoastingRef = useRef<{
		scrollEl: HTMLElement
		startTime: number
		startScrollLeft: number
		startScrollTop: number
		startVelocity: Velocity
	} | null>(null)
	// Synchronous mirror of dragState so the move handler can detect a fresh
	// arming → dragging promotion within the same callback (state is async).
	const dragStateRef = useRef<DragState>('resting')
	// Tracks the pointerId we registered in `claimedPointers` so we can release
	// the global claim on pointerup/cancel/unmount without scanning the set.
	const claimedPointerRef = useRef<number | null>(null)

	// Keep latest callbacks in refs so rAF loops and async paths always reach
	// the current version without needing them in useCallback dep arrays.
	const onEndRef = useRef(onEnd)
	useEffect(() => {
		onEndRef.current = onEnd
	}, [onEnd])
	const onRelativePositionChangeRef = useRef(onRelativePositionChange)
	useEffect(() => {
		onRelativePositionChangeRef.current = onRelativePositionChange
	}, [onRelativePositionChange])

	const transitionTo = useCallback((next: DragState) => {
		dragStateRef.current = next
		setDragState(next)
	}, [])

	const cancelVelocityReset = useCallback(() => {
		if (velocityResetRef.current !== null) {
			clearTimeout(velocityResetRef.current)
			velocityResetRef.current = null
		}
	}, [])

	useEffect(() => {
		return () => {
			cancelVelocityReset()
			if (animationFrameRef.current !== null) {
				cancelAnimationFrame(animationFrameRef.current)
				animationFrameRef.current = null
			}
			coastingStateRef.current = null
			armingRef.current = null
			if (scrollingStateRef.current?.velocityResetTimeout) {
				clearTimeout(scrollingStateRef.current.velocityResetTimeout)
			}
			scrollingStateRef.current = null
			scrollCoastingRef.current = null
			// Release the global claim so a new gesture isn't blocked.
			if (claimedPointerRef.current !== null) {
				claimedPointers.delete(claimedPointerRef.current)
				claimedPointerRef.current = null
			}
		}
	}, [cancelVelocityReset])

	const finishCoasting = useCallback(
		(position: Position, finalVelocity: Velocity) => {
			animationFrameRef.current = null
			coastingStateRef.current = null
			transitionTo('resting')
			onEndRef.current?.({
				x: position.x,
				y: position.y,
				velocity: finalVelocity,
			})
			offsetPositionRef.current = { x: 0, y: 0 }
			velocityRef.current = { x: 0, y: 0 }
			lastMoveRef.current = null
		},
		[transitionTo],
	)

	const step = useCallback(
		(now: number) => {
			const data = coastingStateRef.current
			if (!data) {
				return
			}

			let nextPosition: Position
			let nextVelocity: Velocity
			let done = false

			if (data.target === null) {
				// Pure inertia — closed-form exponential decay, no integration error.
				const elapsedSeconds = (now - data.startTime) / 1000
				const decay = Math.exp(-inertiaFrictionPerSecond * elapsedSeconds)
				nextVelocity = {
					x: data.startVelocity.x * decay,
					y: data.startVelocity.y * decay,
				}
				const travelled = (1 - decay) / inertiaFrictionPerSecond
				nextPosition = {
					x: data.startPosition.x + data.startVelocity.x * travelled,
					y: data.startPosition.y + data.startVelocity.y * travelled,
				}
				if (
					Math.abs(nextVelocity.x) < settleVelocityThreshold &&
					Math.abs(nextVelocity.y) < settleVelocityThreshold
				) {
					nextPosition = projectInertiaEndpoint(
						data.startPosition,
						data.startVelocity,
					)
					nextVelocity = { x: 0, y: 0 }
					done = true
				}
			} else {
				// Snap with inertia — critically damped spring; absorbs release velocity.
				const deltaSeconds = Math.min(
					(now - data.lastFrameTime) / 1000,
					maximumSnapFrameDeltaSeconds,
				)
				const accelerationX =
					-snapStiffness * (data.lastPosition.x - data.target.x) -
					snapDamping * data.lastVelocity.x
				const accelerationY =
					-snapStiffness * (data.lastPosition.y - data.target.y) -
					snapDamping * data.lastVelocity.y
				nextVelocity = {
					x: data.lastVelocity.x + accelerationX * deltaSeconds,
					y: data.lastVelocity.y + accelerationY * deltaSeconds,
				}
				nextPosition = {
					x: data.lastPosition.x + nextVelocity.x * deltaSeconds,
					y: data.lastPosition.y + nextVelocity.y * deltaSeconds,
				}
				const distanceX = nextPosition.x - data.target.x
				const distanceY = nextPosition.y - data.target.y
				if (
					Math.hypot(distanceX, distanceY) < snapDistanceThreshold &&
					Math.abs(nextVelocity.x) < settleVelocityThreshold &&
					Math.abs(nextVelocity.y) < settleVelocityThreshold
				) {
					nextPosition = { x: data.target.x, y: data.target.y }
					nextVelocity = { x: 0, y: 0 }
					done = true
				}
			}

			data.lastPosition = nextPosition
			data.lastVelocity = nextVelocity
			data.lastFrameTime = now

			if (done) {
				finishCoasting(nextPosition, nextVelocity)
			} else {
				offsetPositionRef.current = nextPosition
				velocityRef.current = nextVelocity
				onRelativePositionChangeRef.current({
					x: nextPosition.x,
					y: nextPosition.y,
					velocity: nextVelocity,
				})
				animationFrameRef.current = requestAnimationFrame(step)
			}
		},
		[finishCoasting],
	)

	const startCoasting = useCallback(
		(
			target: Position | null,
			fromPosition: Position,
			fromVelocity: Velocity,
		) => {
			if (animationFrameRef.current !== null) {
				cancelAnimationFrame(animationFrameRef.current)
			}
			const now = performance.now()
			coastingStateRef.current = {
				startTime: now,
				startPosition: fromPosition,
				startVelocity: fromVelocity,
				lastPosition: fromPosition,
				lastVelocity: fromVelocity,
				lastFrameTime: now,
				target,
			}
			transitionTo('coasting')
			animationFrameRef.current = requestAnimationFrame(step)
		},
		[step, transitionTo],
	)

	const scrollStep = useCallback((now: number) => {
		const data = scrollCoastingRef.current
		if (!data) {
			return
		}
		const elapsedSeconds = (now - data.startTime) / 1000
		const decay = Math.exp(-inertiaFrictionPerSecond * elapsedSeconds)
		const velocityX = data.startVelocity.x * decay
		const velocityY = data.startVelocity.y * decay
		if (
			Math.abs(velocityX) < settleVelocityThreshold &&
			Math.abs(velocityY) < settleVelocityThreshold
		) {
			scrollCoastingRef.current = null
			animationFrameRef.current = null
			return
		}
		const travelled = (1 - decay) / inertiaFrictionPerSecond
		const targetScrollLeft =
			data.startScrollLeft + data.startVelocity.x * travelled
		const targetScrollTop =
			data.startScrollTop + data.startVelocity.y * travelled
		const maxScrollLeft = data.scrollEl.scrollWidth - data.scrollEl.clientWidth
		const maxScrollTop = data.scrollEl.scrollHeight - data.scrollEl.clientHeight
		const clampedX = Math.max(0, Math.min(maxScrollLeft, targetScrollLeft))
		const clampedY = Math.max(0, Math.min(maxScrollTop, targetScrollTop))
		data.scrollEl.scrollLeft = clampedX
		data.scrollEl.scrollTop = clampedY
		// Both axes pinned past their edges → no further motion possible, stop.
		const stuckX = clampedX !== targetScrollLeft
		const stuckY = clampedY !== targetScrollTop
		if (stuckX && stuckY) {
			scrollCoastingRef.current = null
			animationFrameRef.current = null
			return
		}
		animationFrameRef.current = requestAnimationFrame(scrollStep)
	}, [])

	const startScrollCoasting = useCallback(
		(scrollEl: HTMLElement, velocityX: number, velocityY: number) => {
			if (animationFrameRef.current !== null) {
				cancelAnimationFrame(animationFrameRef.current)
			}
			scrollCoastingRef.current = {
				scrollEl,
				startTime: performance.now(),
				startScrollLeft: scrollEl.scrollLeft,
				startScrollTop: scrollEl.scrollTop,
				startVelocity: { x: velocityX, y: velocityY },
			}
			animationFrameRef.current = requestAnimationFrame(scrollStep)
		},
		[scrollStep],
	)

	const finishNow = useCallback(
		(position: Position, finalVelocity: Velocity) => {
			transitionTo('resting')
			onEndRef.current?.({
				x: position.x,
				y: position.y,
				velocity: finalVelocity,
			})
			offsetPositionRef.current = { x: 0, y: 0 }
			velocityRef.current = { x: 0, y: 0 }
			lastMoveRef.current = null
		},
		[transitionTo],
	)

	const onPointerDown = useCallback(
		(event: PointerEvent<HTMLElement>) => {
			// If a coasting animation is in flight, the user has grabbed the element back.
			// Drop momentum, fire onEnd with the in-flight position, then start a fresh drag.
			if (animationFrameRef.current !== null) {
				cancelAnimationFrame(animationFrameRef.current)
				animationFrameRef.current = null
				const inFlight = coastingStateRef.current
				if (inFlight) {
					onEndRef.current?.({
						x: inFlight.lastPosition.x,
						y: inFlight.lastPosition.y,
						velocity: { x: 0, y: 0 },
					})
					coastingStateRef.current = null
					offsetPositionRef.current = { x: 0, y: 0 }
					velocityRef.current = { x: 0, y: 0 }
				}
				// Scroll coasting: just halt it, no consumer callbacks (scroll is internal).
				scrollCoastingRef.current = null
			}
			// Discard arming state from any previous gesture that left without
			// either promotion or a tracked pointerup (e.g. drag off-element).
			armingRef.current = null

			startPosition.current = {
				x: event.clientX,
				y: event.clientY,
				// `window.scrollX/Y` only — concurrent scroll on intermediate ancestors
				// during a drag isn't compensated. Drag callers typically don't
				// experience this since pointer capture keeps the gesture pinned.
				scrollX: window.scrollX,
				scrollY: window.scrollY,
			}
			cancelVelocityReset()
			lastMoveRef.current = null
			velocityRef.current = { x: 0, y: 0 }

			// Auto-detect a scrollable subtree only when shouldStart isn't provided
			// and the input is touch/pen — mouse has no scroll-by-drag, so the
			// arming verdict on first move will go straight to drag.
			const scrollableAncestor =
				!shouldStart && event.pointerType !== 'mouse'
					? findScrollableAncestor(event.target, event.currentTarget)
					: null

			// Always arm — never claim or capture on pointerdown. The first move
			// runs the arming verdict; if multiple useDrag instances overlap on
			// the gesture path, the innermost evaluates first via React's natural
			// pointer-event bubble and the global `claimedPointers` set keeps
			// outers from also claiming once an inner has committed.
			armingRef.current = {
				pointerId: event.pointerId,
				scrollableAncestor,
			}
		},
		[shouldStart, cancelVelocityReset],
	)

	const handleEnd = useCallback(
		(byCancellation: boolean) => {
			return (event: PointerEvent<HTMLElement>) => {
				// Release happened while still arming → no claim was ever made, just clean up.
				if (
					armingRef.current &&
					event.pointerId === armingRef.current.pointerId
				) {
					armingRef.current = null
				}
				// Release while we were manually scrolling. If the gesture left
				// behind any meaningful velocity (and wasn't cancelled), hand it off
				// to a scroll-coasting animation so the content keeps gliding.
				if (
					scrollingStateRef.current &&
					event.pointerId === scrollingStateRef.current.pointerId
				) {
					const sm = scrollingStateRef.current
					if (sm.velocityResetTimeout !== null) {
						clearTimeout(sm.velocityResetTimeout)
					}
					if (
						!byCancellation &&
						(Math.abs(sm.velocityX) >= settleVelocityThreshold ||
							Math.abs(sm.velocityY) >= settleVelocityThreshold)
					) {
						startScrollCoasting(sm.scrollEl, sm.velocityX, sm.velocityY)
					}
					scrollingStateRef.current = null
				}
				// Release any global claim we held so a fresh gesture can run the
				// arming race from scratch.
				if (
					claimedPointerRef.current !== null &&
					claimedPointerRef.current === event.pointerId
				) {
					claimedPointers.delete(claimedPointerRef.current)
					claimedPointerRef.current = null
				}
				if (dragStateRef.current !== 'dragging') {
					return
				}

				event.preventDefault()
				cancelVelocityReset()
				event.currentTarget.releasePointerCapture(event.pointerId)
				// Block any click the browser fires after pointerup. Capture phase
				// intercepts before React's root-level synthetic event handler.
				const el = event.currentTarget
				const blockClick = (e: Event) => e.stopPropagation()
				el.addEventListener('click', blockClick, { capture: true })
				setTimeout(() => el.removeEventListener('click', blockClick, true), 0)

				if (byCancellation) {
					finishNow({ x: 0, y: 0 }, { x: 0, y: 0 })
					return
				}

				const useInertia = !!inertia
				const useSnap = !!snapPoints && snapPoints.length > 0

				if (!useInertia && !useSnap) {
					finishNow(offsetPositionRef.current, velocityRef.current)
					return
				}

				if (useSnap && !useInertia) {
					const target = chooseSnapPoint(
						projectInertiaEndpoint(
							offsetPositionRef.current,
							velocityRef.current,
						),
						snapPoints,
					)
					finishNow(target, { x: 0, y: 0 })
					return
				}

				if (
					useInertia &&
					!useSnap &&
					Math.abs(velocityRef.current.x) < settleVelocityThreshold &&
					Math.abs(velocityRef.current.y) < settleVelocityThreshold
				) {
					finishNow(offsetPositionRef.current, velocityRef.current)
					return
				}

				const target =
					useSnap && snapPoints
						? chooseSnapPoint(
								projectInertiaEndpoint(
									offsetPositionRef.current,
									velocityRef.current,
								),
								snapPoints,
							)
						: null
				startCoasting(target, offsetPositionRef.current, velocityRef.current)
			}
		},
		[
			inertia,
			snapPoints,
			cancelVelocityReset,
			finishNow,
			startCoasting,
			startScrollCoasting,
		],
	)

	const onPointerUp = useMemo(() => handleEnd(false), [handleEnd])
	const onPointerCancel = useMemo(() => handleEnd(true), [handleEnd])

	const onPointerMove = useMemo(() => {
		return (event: PointerEvent<HTMLElement>) => {
			// SCROLL MODE: hook is manually scrolling the inner container. Once we
			// commit to scroll for a gesture, the gesture stays in scroll mode until
			// pointerup — even if the scroll hits an edge. Drag has to come from a
			// fresh gesture. Only the axis locked at scroll-mode entry is applied;
			// off-axis movement is dropped on the floor.
			if (scrollingStateRef.current) {
				if (event.pointerId !== scrollingStateRef.current.pointerId) {
					return
				}
				const sm = scrollingStateRef.current
				const dx = event.clientX - sm.lastClientX
				const dy = event.clientY - sm.lastClientY
				event.preventDefault()
				if (sm.lockedAxis === 'y') {
					sm.scrollEl.scrollTop -= dy
				} else {
					sm.scrollEl.scrollLeft -= dx
				}
				const now = performance.now()
				const deltaMilliseconds = now - sm.lastTime
				if (deltaMilliseconds > 0) {
					// Scroll velocity is the negation of the finger velocity (finger
					// down → scroll up); only the locked axis carries any value, the
					// other stays zero so coasting also stays single-axis.
					if (sm.lockedAxis === 'y') {
						sm.velocityX = 0
						sm.velocityY = (-dy / deltaMilliseconds) * 1000
					} else {
						sm.velocityX = (-dx / deltaMilliseconds) * 1000
						sm.velocityY = 0
					}
					if (sm.velocityResetTimeout !== null) {
						clearTimeout(sm.velocityResetTimeout)
					}
					sm.velocityResetTimeout = setTimeout(() => {
						if (scrollingStateRef.current === sm) {
							sm.velocityX = 0
							sm.velocityY = 0
							sm.velocityResetTimeout = null
						}
					}, velocityResetDelayInMilliseconds)
				}
				sm.lastTime = now
				sm.lastClientX = event.clientX
				sm.lastClientY = event.clientY
				return
			}
			// ARMING: first move evaluation — drag, scroll, or release.
			else if (armingRef.current) {
				if (event.pointerId !== armingRef.current.pointerId) {
					return
				}
				// Some other useDrag (innermost via natural bubble) already claimed
				// this gesture — stand down without preventDefault or capture.
				if (claimedPointers.has(event.pointerId)) {
					armingRef.current = null
					return
				}
				const deltaX = event.clientX - startPosition.current.x
				const deltaY = event.clientY - startPosition.current.y
				if (
					Math.abs(deltaX) < armingMoveThresholdPixels &&
					Math.abs(deltaY) < armingMoveThresholdPixels
				) {
					return
				}
				const delta = { x: deltaX, y: deltaY }
				const scrollableAncestor = armingRef.current.scrollableAncestor
				// Lock to the dominant axis of the gesture; off-axis drift is ignored
				// for the rest of the gesture. The auto-detect verdict only checks
				// the locked axis too — a slight horizontal jitter while pulling
				// down at scrollTop=0 won't kick us into scroll mode.
				const lockedAxis: 'x' | 'y' =
					Math.abs(deltaY) >= Math.abs(deltaX) ? 'y' : 'x'
				const axisLockedDelta =
					lockedAxis === 'y' ? { x: 0, y: deltaY } : { x: deltaX, y: 0 }
				const accept = shouldStart
					? shouldStart(delta, { pointerType: event.pointerType })
					: evaluateScrollEdgeAccept(axisLockedDelta, scrollableAncestor)
				if (!accept) {
					if (scrollableAncestor) {
						// Defer to scroll, but the hook drives it — `touch-action: none`
						// means the browser won't. Apply the threshold delta on the
						// locked axis only so the gesture feels continuous. Claim the
						// pointer so any outer useDrag stands down.
						const scrollEl = scrollableAncestor as HTMLElement
						if (lockedAxis === 'y') {
							scrollEl.scrollTop -= deltaY
						} else {
							scrollEl.scrollLeft -= deltaX
						}
						claimedPointers.add(event.pointerId)
						claimedPointerRef.current = event.pointerId
						event.currentTarget.setPointerCapture(event.pointerId)
						scrollingStateRef.current = {
							pointerId: event.pointerId,
							scrollEl,
							lockedAxis,
							lastClientX: event.clientX,
							lastClientY: event.clientY,
							lastTime: performance.now(),
							velocityX: 0,
							velocityY: 0,
							velocityResetTimeout: null,
						}
						armingRef.current = null
						event.preventDefault()
						return
					}
					// No scroll target — release without claiming so the gesture can
					// bubble to an outer useDrag that may want it.
					armingRef.current = null
					return
				}
				// Drag verdict: claim the pointer (blocks outer useDrags), capture,
				// and reset startPosition to the current point so the drag begins
				// from where the finger is now (no jump by the threshold pixels).
				claimedPointers.add(event.pointerId)
				claimedPointerRef.current = event.pointerId
				event.currentTarget.setPointerCapture(event.pointerId)
				armingRef.current = null
				startPosition.current = {
					x: event.clientX,
					y: event.clientY,
					scrollX: window.scrollX,
					scrollY: window.scrollY,
				}
				transitionTo('dragging')
				onStart?.()
				// fall through to drag-move logic
			} else if (dragStateRef.current !== 'dragging') {
				return
			}

			event.preventDefault()
			const now = performance.now()
			const newOffsetPosition = {
				x:
					event.clientX +
					window.scrollX -
					(startPosition.current.x + startPosition.current.scrollX),
				y:
					event.clientY +
					window.scrollY -
					(startPosition.current.y + startPosition.current.scrollY),
			}
			if (lastMoveRef.current !== null) {
				const deltaMilliseconds = now - lastMoveRef.current.time
				if (deltaMilliseconds > 0) {
					const newVelocity = {
						x:
							((newOffsetPosition.x - lastMoveRef.current.x) /
								deltaMilliseconds) *
							1000,
						y:
							((newOffsetPosition.y - lastMoveRef.current.y) /
								deltaMilliseconds) *
							1000,
					}
					velocityRef.current = newVelocity
					cancelVelocityReset()
					velocityResetRef.current = setTimeout(() => {
						velocityRef.current = { x: 0, y: 0 }
						onRelativePositionChangeRef.current({
							x: offsetPositionRef.current.x,
							y: offsetPositionRef.current.y,
							velocity: { x: 0, y: 0 },
						})
						velocityResetRef.current = null
					}, velocityResetDelayInMilliseconds)
				}
			}
			lastMoveRef.current = {
				time: now,
				x: newOffsetPosition.x,
				y: newOffsetPosition.y,
			}
			offsetPositionRef.current = newOffsetPosition
			onRelativePositionChangeRef.current({
				x: newOffsetPosition.x,
				y: newOffsetPosition.y,
				velocity: velocityRef.current,
			})
		}
	}, [shouldStart, onStart, transitionTo, cancelVelocityReset])

	const elementProps = useMemo(
		() => ({
			onPointerDown,
			onPointerUp,
			onPointerMove,
			onPointerCancel,
		}),
		[onPointerDown, onPointerMove, onPointerUp, onPointerCancel],
	)

	return useMemo(
		() => ({ state: dragState, elementProps }),
		[dragState, elementProps],
	)
}
