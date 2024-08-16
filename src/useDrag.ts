import {
	PointerEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react'

export const useDrag = (options: {
	onRelativePositionChange: (x: number, y: number) => void
	onStart?: () => void
	onEnd?: (x: number, y: number) => void
}) => {
	const { onRelativePositionChange, onStart, onEnd } = options
	const [isMoving, setIsMoving] = useState(false)
	const startPosition = useRef({ x: 0, y: 0, scrollX: 0, scrollY: 0 })
	const [offsetPosition, setOffsetPosition] = useState({ x: 0, y: 0 })

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
			setIsMoving(true)
			onStart?.()
		},
		[onStart],
	)

	const handleEnd = useCallback(
		(byCancellation: boolean) => {
			if (!isMoving) {
				return undefined
			}
			return (event: PointerEvent<HTMLElement>) => {
				event.preventDefault()
				setIsMoving(false)
				event.currentTarget.releasePointerCapture(event.pointerId)
				onEnd?.(
					byCancellation ? 0 : offsetPosition.x,
					byCancellation ? 0 : offsetPosition.y,
				)
				setOffsetPosition({ x: 0, y: 0 })
			}
		},
		[isMoving, offsetPosition.x, offsetPosition.y, onEnd],
	)

	const onPointerUp = useMemo(() => handleEnd(false), [handleEnd])
	const onPointerCancel = useMemo(() => handleEnd(true), [handleEnd])

	const onPointerMove = useMemo(() => {
		if (!isMoving) {
			return undefined
		}
		return (event: PointerEvent<HTMLElement>) => {
			event.preventDefault()
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
			setOffsetPosition(newOffsetPosition)
		}
	}, [isMoving])

	useEffect(() => {
		onRelativePositionChange(offsetPosition.x, offsetPosition.y)
	}, [offsetPosition.x, offsetPosition.y, onRelativePositionChange])

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
