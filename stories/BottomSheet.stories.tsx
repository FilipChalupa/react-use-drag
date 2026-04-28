import type { Meta, StoryObj } from '@storybook/react'
import { useCallback, useState } from 'react'
import {
	useDrag,
	type Position,
	type PositionWithVelocity,
} from '../src/index'
import { sourceLink } from './sourceLink'
import './styles.css'

interface MailItem {
	id: number
	subject: string
	preview: string
	isRead: boolean
}

const initialMail: MailItem[] = Array.from({ length: 14 }, (_, index) => ({
	id: index + 1,
	subject: `Subject ${index + 1}: lorem ipsum dolor sit amet`,
	preview:
		'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor.',
	isRead: false,
}))

const archiveThreshold = 100
const archiveSlideOffPixels = 480
const archiveAnimationMilliseconds = 200

interface SwipeItemProps {
	item: MailItem
	onArchive: (id: number) => void
	onMarkRead: (id: number) => void
}

const SwipeItem = ({ item, onArchive, onMarkRead }: SwipeItemProps) => {
	const [offset, setOffset] = useState(0)
	const [isArchiving, setIsArchiving] = useState(false)

	const onRelativePositionChange = useCallback(
		({ x }: PositionWithVelocity) => {
			setOffset(x)
		},
		[],
	)

	const onEnd = useCallback(
		({ x }: PositionWithVelocity) => {
			if (Math.abs(x) > archiveThreshold) {
				setIsArchiving(true)
				setOffset(x > 0 ? archiveSlideOffPixels : -archiveSlideOffPixels)
				setTimeout(() => {
					onArchive(item.id)
				}, archiveAnimationMilliseconds)
			} else {
				setOffset(0)
			}
		},
		[item.id, onArchive],
	)

	// Horizontal-dominant gestures become item swipes; otherwise the gesture
	// bubbles up so the outer sheet's useDrag (scroll mode or sheet drag) gets
	// a chance via the global nested-useDrag coordinator.
	const shouldStart = useCallback((delta: Position) => {
		return Math.abs(delta.x) > Math.abs(delta.y)
	}, [])

	const { elementProps, state } = useDrag({
		onRelativePositionChange,
		onEnd,
		shouldStart,
	})

	return (
		<div className="swipe-row">
			<div className="swipe-row-action swipe-row-action-left">Archive</div>
			<div className="swipe-row-action swipe-row-action-right">Snooze</div>
			<div
				className={`swipe-row-content ${state === 'dragging' || isArchiving ? '' : 'is-settled'}`}
				style={{ '--x': `${offset}px` } as React.CSSProperties}
				onClick={() => onMarkRead(item.id)}
				{...(isArchiving ? {} : elementProps)}
			>
				<div className={`swipe-row-subject${item.isRead ? ' is-read' : ''}`}>
					{!item.isRead && <span className="swipe-row-unread-dot" />}
					{item.subject}
				</div>
				<div className="swipe-row-preview">{item.preview}</div>
			</div>
		</div>
	)
}

const BottomSheet = () => {
	const [position, setPosition] = useState({ x: 0, y: 0 })
	const [positionOffset, setPositionOffset] = useState({ x: 0, y: 0 })
	const [items, setItems] = useState(initialMail)

	const onRelativePositionChange = useCallback(
		({ x, y }: PositionWithVelocity) => {
			setPositionOffset({ x, y })
		},
		[],
	)
	const onEnd = useCallback(({ x, y }: PositionWithVelocity) => {
		setPosition((previous) => ({ x: previous.x + x, y: previous.y + y }))
		setPositionOffset({ x: 0, y: 0 })
	}, [])

	const { elementProps, state } = useDrag({
		onRelativePositionChange,
		onEnd,
	})

	const handleArchive = useCallback((id: number) => {
		setItems((previous) => previous.filter((item) => item.id !== id))
	}, [])

	const handleMarkRead = useCallback((id: number) => {
		setItems((previous) =>
			previous.map((item) =>
				item.id === id ? { ...item, isRead: true } : item,
			),
		)
	}, [])

	const y = position.y + positionOffset.y

	return (
		<div className="bottom-sheet-canvas">
			<pre className="readout">{`sheet: ${state}`}</pre>
			<div
				className="bottom-sheet"
				style={{ '--y': `${y}px` } as React.CSSProperties}
				{...elementProps}
			>
				<div className="bottom-sheet-handle" />
				<div className="bottom-sheet-content">
					{items.length > 0 ? (
						items.map((item) => (
							<SwipeItem
								key={item.id}
								item={item}
								onArchive={handleArchive}
								onMarkRead={handleMarkRead}
							/>
						))
					) : (
						<div className="bottom-sheet-empty">
							All caught up — drag to close
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

const meta: Meta<typeof BottomSheet> = {
	title: 'useDrag/Bottom Sheet',
	component: BottomSheet,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component: `A bottom sheet with **nested \`useDrag\` instances**: one \`useDrag\` on the whole sheet (auto-detects the scrollable list inside, so it drives both vertical scroll and pull-to-close drag), plus one per row for horizontal swipe-to-archive (Apple Mail / Gmail style). Both levels are spread the natural way — single \`elementProps\` on the wrapper, single \`elementProps\` per row.

The hook itself coordinates the nesting via a small module-level singleton: on \`pointerdown\` no one captures yet; on the first move past the threshold the **innermost hook evaluates first** (React's natural pointer-event bubble order). If the innermost claims the gesture (e.g. row's horizontal \`shouldStart\` returns \`true\`), it captures and outers stand down. If it doesn't claim (vertical on a row), the gesture bubbles to the outer hook, which can then claim itself (scroll mode, or pull-to-close drag at the scroll edge).

Behavior to try:

- Drag the handle bar → sheet drags down.
- Pull down on the content with items at the very top → sheet drags (rubber-band edge).
- Scroll the list → vertical gesture on either content padding or a row enters scroll mode.
- Swipe a row left or right past the threshold → row archives.
- Archive everything → empty content area still drags the sheet (no scrollable to defer to).

${sourceLink('BottomSheet.stories.tsx')}`,
			},
		},
	},
}

export default meta

export const Default: StoryObj<typeof BottomSheet> = {}
