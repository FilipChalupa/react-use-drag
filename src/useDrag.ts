import {
	PointerEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react'

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
	 * target is delivered through this callback — `onRelativePositionChange` may
	 * not emit it, because the hook resets its internal offset in the same React
	 * batch.
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
	 * threshold. Return `false` to abandon the gesture so native behavior
	 * (e.g. scroll on a `pan-y` element) can continue, `true` to take over as a
	 * drag.
	 *
	 * When omitted, the hook auto-detects: on `pointerdown` it walks from the
	 * event target up to the drag root looking for a scrollable element. If one
	 * is found and the input is touch/pen, the gesture is held back until first
	 * move; the drag takes over only when the scroll container has nowhere left
	 * to scroll in the gesture's direction (the standard bottom-sheet pattern).
	 * Mouse input always drags immediately because there's no native scroll-by-
	 * drag to defer to.
	 *
	 * Set `touch-action` accordingly on the scrollable element: `pan-x` / `pan-y`
	 * lets the browser do the native scroll the hook is deferring to.
	 *
	 * The second argument carries `pointerType` so the consumer can short-circuit
	 * by input mode.
	 */
	shouldStart?: (
		firstMove: Position,
		info: { pointerType: string },
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
const inertiaFrictionPerSecond = 6 // exponent k in v(t) = v0 · e^(-k·t); projected travel = v0 / k
const settleVelocityThreshold = 20 // px/s; below this on both axes coasting is considered settled
const snapDistanceThreshold = 0.5 // px; spring is considered settled below this distance from target
const snapStiffness = 180
const snapDamping = 2 * Math.sqrt(snapStiffness) // critical damping — never overshoots
const maximumSnapFrameDeltaSeconds = 0.032 // clamp dt so a backgrounded tab can't blow up the spring
const armingMoveThresholdPixels = 5 // minimum movement on either axis before shouldStart is evaluated

const projectInertiaEndpoint = (
	start: Position,
	velocity: Velocity,
): Position => ({
	x: start.x + velocity.x / inertiaFrictionPerSecond,
	y: start.y + velocity.y / inertiaFrictionPerSecond,
})

const chooseSnapPoint = (
	projected: Position,
	points: Position[],
): Position => {
	let best = points[0]
	let bestDistance = Infinity
	for (const point of points) {
		const deltaX = point.x - projected.x
		const deltaY = point.y - projected.y
		const distance = deltaX * deltaX + deltaY * deltaY
		if (distance < bestDistance) {
			bestDistance = distance
			best = point
		}
	}
	return best
}

interface CoastingData {
	startTime: number
	startPosition: Position
	startVelocity: Velocity
	lastPosition: Position
	lastVelocity: Velocity
	lastFrameTime: number
	target: Position | null
}

const findScrollableAncestor = (
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

// Default arming verdict when shouldStart isn't supplied: defer to native scroll
// while the container has room to move in the gesture's direction; otherwise
// promote to drag (rubber-band edges).
const evaluateScrollEdgeAccept = (
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
	const [offsetPosition, setOffsetPosition] = useState({ x: 0, y: 0 })
	const [velocity, setVelocity] = useState<Velocity>({ x: 0, y: 0 })
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
	// Synchronous mirror of dragState so the move handler can detect a fresh
	// arming → dragging promotion within the same callback (state is async).
	const dragStateRef = useRef<DragState>('resting')

	// Latest onEnd kept in a ref so the requestAnimationFrame loop and the
	// abort-on-grab path always reach the current callback even after an
	// in-flight coasting animation captured an older closure.
	const onEndRef = useRef(onEnd)
	useEffect(() => {
		onEndRef.current = onEnd
	}, [onEnd])

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
			setOffsetPosition({ x: 0, y: 0 })
			setVelocity({ x: 0, y: 0 })
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
			setOffsetPosition(nextPosition)
			setVelocity(nextVelocity)

			if (done) {
				finishCoasting(nextPosition, nextVelocity)
			} else {
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

	const finishNow = useCallback(
		(position: Position, finalVelocity: Velocity) => {
			transitionTo('resting')
			onEndRef.current?.({
				x: position.x,
				y: position.y,
				velocity: finalVelocity,
			})
			setOffsetPosition({ x: 0, y: 0 })
			setVelocity({ x: 0, y: 0 })
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
					setOffsetPosition({ x: 0, y: 0 })
					setVelocity({ x: 0, y: 0 })
				}
			}
			// Discard arming state from any previous gesture that left without
			// either promotion or a tracked pointerup (e.g. drag off-element).
			armingRef.current = null

			startPosition.current = {
				x: event.clientX,
				y: event.clientY,
				scrollX: window.scrollX, // @TODO: handle any parent scroll
				scrollY: window.scrollY, // @TODO: handle any parent scroll
			}
			cancelVelocityReset()
			lastMoveRef.current = null
			setVelocity({ x: 0, y: 0 })

			// Auto-detect a scrollable subtree only when shouldStart isn't provided
			// and the input has a native scroll fallback to defer to (i.e. not mouse).
			const scrollableAncestor =
				!shouldStart && event.pointerType !== 'mouse'
					? findScrollableAncestor(event.target, event.currentTarget)
					: null

			if (shouldStart || scrollableAncestor) {
				// Capture the pointer immediately so the browser doesn't steal the
				// gesture for native scroll/pan before we get a chance to evaluate
				// it. We don't preventDefault yet — the arming verdict on the first
				// move decides whether the gesture becomes a drag or is released.
				event.currentTarget.setPointerCapture(event.pointerId)
				armingRef.current = {
					pointerId: event.pointerId,
					scrollableAncestor,
				}
				return
			}

			event.preventDefault()
			event.currentTarget.setPointerCapture(event.pointerId)
			transitionTo('dragging')
			onStart?.()
		},
		[onStart, shouldStart, cancelVelocityReset, transitionTo],
	)

	const handleEnd = useCallback(
		(byCancellation: boolean) => {
			return (event: PointerEvent<HTMLElement>) => {
				// Release happened while still arming → no drag was ever started, just clean up.
				if (
					armingRef.current &&
					event.pointerId === armingRef.current.pointerId
				) {
					armingRef.current = null
				}
				if (dragStateRef.current !== 'dragging') {
					return
				}

				event.preventDefault()
				cancelVelocityReset()
				event.currentTarget.releasePointerCapture(event.pointerId)

				if (byCancellation) {
					finishNow({ x: 0, y: 0 }, { x: 0, y: 0 })
					return
				}

				const useInertia = !!inertia
				const useSnap = !!snapPoints && snapPoints.length > 0

				if (!useInertia && !useSnap) {
					finishNow(offsetPosition, velocity)
					return
				}

				if (useSnap && !useInertia) {
					const target = chooseSnapPoint(
						projectInertiaEndpoint(offsetPosition, velocity),
						snapPoints,
					)
					finishNow(target, { x: 0, y: 0 })
					return
				}

				if (
					useInertia &&
					!useSnap &&
					Math.abs(velocity.x) < settleVelocityThreshold &&
					Math.abs(velocity.y) < settleVelocityThreshold
				) {
					finishNow(offsetPosition, velocity)
					return
				}

				const target =
					useSnap && snapPoints
						? chooseSnapPoint(
								projectInertiaEndpoint(offsetPosition, velocity),
								snapPoints,
							)
						: null
				startCoasting(target, offsetPosition, velocity)
			}
		},
		[
			offsetPosition,
			velocity,
			inertia,
			snapPoints,
			cancelVelocityReset,
			finishNow,
			startCoasting,
		],
	)

	const onPointerUp = useMemo(() => handleEnd(false), [handleEnd])
	const onPointerCancel = useMemo(() => handleEnd(true), [handleEnd])

	const onPointerMove = useMemo(() => {
		return (event: PointerEvent<HTMLElement>) => {
			// Arming branch: decide whether this gesture should become a drag.
			if (armingRef.current) {
				if (event.pointerId !== armingRef.current.pointerId) {
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
				const accept = shouldStart
					? shouldStart(delta, { pointerType: event.pointerType })
					: evaluateScrollEdgeAccept(
							delta,
							armingRef.current.scrollableAncestor,
						)
				if (!accept) {
					// Hand the gesture back so native scroll/whatever can take over.
					event.currentTarget.releasePointerCapture(event.pointerId)
					armingRef.current = null
					return
				}
				// Promote: pointer is already captured (we claimed it on pointerdown
				// to keep the browser from stealing the gesture). Reset startPosition
				// to the current point so the drag begins from where the finger is
				// now, instead of jumping by the threshold pixels we waited out.
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
					setVelocity(newVelocity)
					cancelVelocityReset()
					velocityResetRef.current = setTimeout(() => {
						setVelocity({ x: 0, y: 0 })
						velocityResetRef.current = null
					}, velocityResetDelayInMilliseconds)
				}
			}
			lastMoveRef.current = {
				time: now,
				x: newOffsetPosition.x,
				y: newOffsetPosition.y,
			}
			setOffsetPosition(newOffsetPosition)
		}
	}, [shouldStart, onStart, transitionTo, cancelVelocityReset])

	useEffect(() => {
		onRelativePositionChange({
			x: offsetPosition.x,
			y: offsetPosition.y,
			velocity,
		})
	}, [offsetPosition.x, offsetPosition.y, velocity, onRelativePositionChange])

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
