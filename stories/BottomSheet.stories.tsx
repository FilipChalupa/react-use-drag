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
}

const initialMail: MailItem[] = Array.from({ length: 14 }, (_, index) => ({
	id: index + 1,
	subject: `Subject ${index + 1}: lorem ipsum dolor sit amet`,
	preview:
		'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor.',
}))

const archiveThreshold = 100
const archiveSlideOffPixels = 480
const archiveAnimationMilliseconds = 200

interface SwipeItemProps {
	item: MailItem
	onArchive: (id: number) => void
}

const SwipeItem = ({ item, onArchive }: SwipeItemProps) => {
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

	// Horizontal-dominant gestures become item swipes; vertical bubbles up so
	// the parent's native scroll still scrolls the list. Mouse always swipes.
	const shouldStart = useCallback(
		(delta: Position, info: { pointerType: string }) => {
			if (info.pointerType === 'mouse') {
				return true
			}
			return Math.abs(delta.x) > Math.abs(delta.y)
		},
		[],
	)

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
				{...(isArchiving ? {} : elementProps)}
			>
				<div className="swipe-row-subject">{item.subject}</div>
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

	const y = position.y + positionOffset.y

	return (
		<div className="bottom-sheet-canvas">
			<pre className="bottom-sheet-readout">{`sheet: ${state}`}</pre>
			<div
				className="bottom-sheet"
				style={{ '--y': `${y}px` } as React.CSSProperties}
			>
				<div className="bottom-sheet-handle" {...elementProps} />
				<div className="bottom-sheet-content">
					{items.map((item) => (
						<SwipeItem
							key={item.id}
							item={item}
							onArchive={handleArchive}
						/>
					))}
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
				component: `A bottom sheet with **nested \`useDrag\` instances**: the sheet itself drags vertically (handle bar at the top), and each row inside swipes horizontally to archive (Apple Mail / Gmail style). The two interactions don't fight each other because each level of the hook is given a different gesture axis via \`touch-action\` and \`shouldStart\`.

Layout:

- The sheet's \`useDrag\` only sees the handle (\`touch-action: none\`). No scrollable subtree under it, so it drags immediately.
- The content area is a plain native-scroll list (\`overflow-y: auto\`, \`touch-action: pan-y\`) — the browser handles vertical scroll.
- Each row has its own \`useDrag\` with a horizontal-dominant \`shouldStart\`. Vertical gestures bubble up to the browser's native scroll; horizontal gestures swipe the row. Releasing past a threshold archives the item.

Trade-off vs the simple \`Scrollable\` story: pulling on the content area no longer drags the whole sheet down — only the handle does. That's the price of letting the row-level \`useDrag\` coexist with native list scroll.

${sourceLink('BottomSheet.stories.tsx')}`,
			},
		},
	},
}

export default meta

export const Default: StoryObj<typeof BottomSheet> = {}
