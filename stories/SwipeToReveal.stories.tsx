import type { Meta, StoryObj } from '@storybook/react'
import { useCallback, useMemo, useState } from 'react'
import { useDrag, type Position, type PositionWithVelocity } from '../src/index'
import { sourceLink } from './sourceLink'
import './styles.css'

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

interface MailItem {
	id: number
	subject: string
	sender: string
	preview: string
	isRead: boolean
}

const initialMail: MailItem[] = [
	{
		id: 1,
		subject: 'Team standup notes',
		sender: 'Jana Nováková',
		preview:
			"Here are the key takeaways from today's standup — please review before tomorrow.",
		isRead: false,
	},
	{
		id: 2,
		subject: 'Invoice #1042 due Friday',
		sender: 'Billing',
		preview: 'Please process payment before the end of the week.',
		isRead: false,
	},
	{
		id: 3,
		subject: 'PR review requested',
		sender: 'GitHub',
		preview:
			'FilipChalupa requested your review on "feat: add swipe-to-reveal story".',
		isRead: false,
	},
	{
		id: 4,
		subject: 'You have a new follower',
		sender: 'GitHub',
		preview: 'Someone started following your repository.',
		isRead: true,
	},
	{
		id: 5,
		subject: 'Weekly digest',
		sender: 'Substack',
		preview:
			"Here's what happened this week in your subscriptions. Plus: top reads.",
		isRead: false,
	},
]

interface SwipeRowProps {
	item: MailItem
	onArchive: (id: number) => void
	onSnooze: (id: number) => void
	onTap: (id: number) => void
}

const SwipeRow = ({ item, onArchive, onSnooze, onTap }: SwipeRowProps) => {
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

	const swipeBg =
		offset > 0 ? '#2e7d32' : offset < 0 ? '#ef6c00' : undefined
	const dragDirection = offset > 0 ? 'right' : offset < 0 ? 'left' : null

	return (
		<div
			className={`swipe-row${dragDirection ? ` is-pulling-${dragDirection}` : ''}`}
			style={swipeBg ? ({ '--swipe-bg': swipeBg } as React.CSSProperties) : undefined}
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

const SwipeToReveal = () => {
	const [items, setItems] = useState(initialMail)
	const [archived, setArchived] = useState(0)
	const [snoozed, setSnoozed] = useState(0)

	const handleArchive = useCallback((id: number) => {
		setItems((previous) => previous.filter((item) => item.id !== id))
		setArchived((n) => n + 1)
	}, [])

	const handleSnooze = useCallback((id: number) => {
		setItems((previous) => previous.filter((item) => item.id !== id))
		setSnoozed((n) => n + 1)
	}, [])

	const handleTap = useCallback((id: number) => {
		setItems((previous) =>
			previous.map((item) =>
				item.id === id ? { ...item, isRead: true } : item,
			),
		)
	}, [])

	return (
		<div className="swipe-list-canvas">
			<div className="swipe-list-card">
				{items.length > 0 ? (
					items.map((item) => (
						<SwipeRow
							key={item.id}
							item={item}
							onArchive={handleArchive}
							onSnooze={handleSnooze}
							onTap={handleTap}
						/>
					))
				) : (
					<div className="swipe-list-empty">Inbox zero ✓</div>
				)}
			</div>
			<div className="swipe-list-counters">
				<span className="swipe-list-counter swipe-list-counter-archive">
					Archived: {archived}
				</span>
				<span className="swipe-list-counter swipe-list-counter-snooze">
					Snoozed: {snoozed}
				</span>
			</div>
		</div>
	)
}

const meta: Meta<typeof SwipeToReveal> = {
	title: 'useDrag/Swipe to Reveal',
	component: SwipeToReveal,
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
		docs: {
			description: {
				component: `A classic mobile inbox pattern: swipe a row **right** to reveal the green **Archive** action, swipe **left** to reveal the orange **Snooze** action. Release past the threshold to trigger; release early to snap back.

Each row is its own \`useDrag\` instance. The \`shouldStart\` callback ensures only horizontal-dominant gestures are captured.

**Works inside a scrollable container.** When \`shouldStart\` is provided, the hook never auto-detects a scrollable ancestor — so vertical scroll has to come from the browser directly. That's why the row uses \`touch-action: pan-y\` instead of \`touch-action: none\`: the browser owns vertical panning, the hook owns horizontal swipes. For a purely horizontal gesture the hook calls \`setPointerCapture\` before the browser can intervene; for a vertical one it releases cleanly and the browser takes over.

${sourceLink('SwipeToReveal.stories.tsx')}`,
			},
		},
	},
}

export default meta

export const Default: StoryObj<typeof SwipeToReveal> = {}
