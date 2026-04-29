import { useCallback, useMemo, useState } from 'react'
import { useDrag, type Position, type PositionWithVelocity } from '../src/index'

const actionWidth = 80
const slideOffPixels = 480
const animationDuration = 200

// World-space X positions of all snap points: dismiss left, snooze, center, archive, dismiss right.
const worldSnapX = [
	-slideOffPixels,
	-actionWidth,
	0,
	actionWidth,
	slideOffPixels,
]

export interface MailItem {
	id: number
	subject: string
	sender: string
	preview: string
	isRead: boolean
}

export interface SwipeRowProps {
	item: MailItem
	onArchive: (id: number) => void
	onSnooze: (id: number) => void
	onTap: (id: number) => void
}

export const SwipeRow = ({
	item,
	onArchive,
	onSnooze,
	onTap,
}: SwipeRowProps) => {
	// snapBase = world-space settled position (0, ±actionWidth). Distinct from
	// offset (which changes every drag frame) so snapPoints stay stable during drag.
	const [snapBase, setSnapBase] = useState(0)
	const [offset, setOffset] = useState(0)
	const [isDismissing, setIsDismissing] = useState(false)

	// Translate world-space snap positions into drag-relative coordinates so
	// useDrag can own snap-point selection and the spring animation.
	const snapPoints = useMemo(
		() => worldSnapX.map((x) => ({ x: x - snapBase, y: 0 })),
		[snapBase],
	)

	// The hook keeps callbacks in refs (onRelativePositionChangeRef, onEndRef),
	// so it always calls the latest version — snapBase in deps is safe.
	const onRelativePositionChange = useCallback(
		({ x }: PositionWithVelocity) => {
			setOffset(snapBase + x)
		},
		[snapBase],
	)

	// onEnd receives the exact settled snap-point position (drag-relative).
	// useDrag doesn't emit onRelativePositionChange for the final position, so
	// we set offset explicitly to avoid a sub-pixel jump on the last frame.
	const onEnd = useCallback(
		({ x }: PositionWithVelocity) => {
			const worldX = snapBase + x
			setOffset(worldX)
			if (Math.abs(worldX) > actionWidth * 1.5) {
				setIsDismissing(true)
				if (worldX > 0) onArchive(item.id)
				else onSnooze(item.id)
			} else {
				setSnapBase(worldX)
			}
		},
		[snapBase, item.id, onArchive, onSnooze],
	)

	// Button-click dismiss: hook is idle, so drive the exit via CSS transition.
	const dismiss = useCallback(
		(direction: 1 | -1) => {
			setIsDismissing(true)
			setOffset(direction * slideOffPixels)
			setTimeout(
				() => (direction > 0 ? onArchive(item.id) : onSnooze(item.id)),
				animationDuration,
			)
		},
		[item.id, onArchive, onSnooze],
	)

	// Horizontal-dominant gestures become row swipes; vertical gestures are
	// released so an outer useDrag (e.g. a scroll container or bottom sheet)
	// can claim them via the global nested-useDrag coordinator.
	const shouldStart = useCallback(
		(delta: Position) => Math.abs(delta.x) > Math.abs(delta.y),
		[],
	)

	const { elementProps, state } = useDrag({
		onRelativePositionChange,
		onEnd,
		shouldStart,
		snapPoints,
		inertia: true,
	})

	const archiveActive = offset > actionWidth / 2
	const snoozeActive = offset < -actionWidth / 2

	const swipeBg = offset > 0 ? '#2e7d32' : offset < 0 ? '#ef6c00' : undefined
	const dragDirection = offset > 0 ? 'right' : offset < 0 ? 'left' : null

	return (
		<div
			className={`swipe-row${
				dragDirection ? ` is-pulling-${dragDirection}` : ''
			}`}
			style={
				swipeBg ? ({ '--swipe-bg': swipeBg } as React.CSSProperties) : undefined
			}
		>
			<button
				className={`swipe-row-action swipe-row-action-left${
					archiveActive ? ' is-active' : ''
				}`}
				onClick={() => dismiss(1)}
			>
				Archive
			</button>
			<button
				className={`swipe-row-action swipe-row-action-right${
					snoozeActive ? ' is-active' : ''
				}`}
				onClick={() => dismiss(-1)}
			>
				Snooze
			</button>
			<button
				className={`swipe-row-content${
					state === 'resting' ? ' is-settled' : ''
				}`}
				style={{ '--x': `${offset}px` } as React.CSSProperties}
				onClick={() => onTap(item.id)}
				{...(isDismissing ? {} : elementProps)}
			>
				<div className={`swipe-row-subject${item.isRead ? ' is-read' : ''}`}>
					{!item.isRead && <span className="swipe-row-unread-dot" />}
					{item.subject}
				</div>
				<div className="swipe-row-sender">{item.sender}</div>
				<div className="swipe-row-preview">{item.preview}</div>
			</button>
		</div>
	)
}
