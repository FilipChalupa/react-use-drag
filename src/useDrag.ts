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
	/** Current drag velocity in pixels per second. */
	velocity: Velocity
}

export interface UseDragOptions {
	/** Called when the position changes during dragging. Position is relative to the start. */
	onRelativePositionChange: (position: Position) => void
	/** Optional. Called when the dragging interaction starts. */
	onStart?: () => void
	/** Optional. Called when the dragging interaction ends. Receives final relative position. On cancellation x, y and velocity are 0. */
	onEnd?: (position: Position) => void
}

/**
 * Hook to handle drag interactions using Pointer Events.
 *
 * @param options - Configuration options for the drag interaction.
 * @returns An object containing:
 * - `isMoving`: boolean indicating if dragging is active.
 * - `elementProps`: props to spread onto the draggable element.
 *
 * @example
 * const { elementProps, isMoving } = useDrag({
 *   onRelativePositionChange: ({ x, y, velocity }) => console.log('Offset:', x, y, 'Velocity:', velocity),
 * })
 * return <div {...elementProps} style={{ touchAction: 'none' }} />
 */

const velocityResetDelayInMilliseconds = 100 // ms without movement before velocity drops to zero

export const useDrag = (options: UseDragOptions) => {
	const { onRelativePositionChange, onStart, onEnd } = options
	const [isMoving, setIsMoving] = useState(false)
	const startPosition = useRef({ x: 0, y: 0, scrollX: 0, scrollY: 0 })
	const [offsetPosition, setOffsetPosition] = useState({ x: 0, y: 0 })
	const [velocity, setVelocity] = useState<Velocity>({ x: 0, y: 0 })
	const lastMoveRef = useRef<{ time: number; x: number; y: number } | null>(
		null,
	)
	const velocityResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const cancelVelocityReset = useCallback(() => {
		if (velocityResetRef.current !== null) {
			clearTimeout(velocityResetRef.current)
			velocityResetRef.current = null
		}
	}, [])

	useEffect(() => {
		return cancelVelocityReset
	}, [cancelVelocityReset])

	const onPointerDown = useCallback(
		(event: PointerEvent<HTMLElement>) => {
			event.preventDefault()
			startPosition.current = {
				x: event.clientX,
				y: event.clientY,
				scrollX: window.scrollX, // @TODO: handle any parent scroll
				scrollY: window.scrollY, // @TODO: handle any parent scroll
			}
			event.currentTarget.setPointerCapture(event.pointerId)
			cancelVelocityReset()
			lastMoveRef.current = null
			setVelocity({ x: 0, y: 0 })
			setIsMoving(true)
			onStart?.()
		},
		[onStart, cancelVelocityReset],
	)

	const handleEnd = useCallback(
		(byCancellation: boolean) => {
			if (!isMoving) {
				return undefined
			}
			return (event: PointerEvent<HTMLElement>) => {
				event.preventDefault()
				cancelVelocityReset()
				setIsMoving(false)
				event.currentTarget.releasePointerCapture(event.pointerId)
				onEnd?.({
					x: byCancellation ? 0 : offsetPosition.x,
					y: byCancellation ? 0 : offsetPosition.y,
					velocity: byCancellation ? { x: 0, y: 0 } : velocity,
				})
				setOffsetPosition({ x: 0, y: 0 })
				setVelocity({ x: 0, y: 0 })
				lastMoveRef.current = null
			}
		},
		[
			isMoving,
			offsetPosition.x,
			offsetPosition.y,
			velocity,
			onEnd,
			cancelVelocityReset,
		],
	)

	const onPointerUp = useMemo(() => handleEnd(false), [handleEnd])
	const onPointerCancel = useMemo(() => handleEnd(true), [handleEnd])

	const onPointerMove = useMemo(() => {
		if (!isMoving) {
			return undefined
		}
		return (event: PointerEvent<HTMLElement>) => {
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
				const dt = now - lastMoveRef.current.time
				if (dt > 0) {
					const newVelocity = {
						x: ((newOffsetPosition.x - lastMoveRef.current.x) / dt) * 1000,
						y: ((newOffsetPosition.y - lastMoveRef.current.y) / dt) * 1000,
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
	}, [isMoving, cancelVelocityReset])

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

	return useMemo(() => ({ isMoving, elementProps }), [isMoving, elementProps])
}
