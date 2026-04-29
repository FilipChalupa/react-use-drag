import type { Meta, StoryObj } from '@storybook/react'
import { useCallback, useState } from 'react'
import { useDrag, type PositionWithVelocity } from '../src/index'
import { sourceLink } from './sourceLink'
import { SwipeRow, type MailItem } from './SwipeRow'
import './styles.css'

const initialMail: MailItem[] = Array.from({ length: 14 }, (_, index) => ({
	id: index + 1,
	subject: `Subject ${index + 1}: lorem ipsum dolor sit amet`,
	sender: 'Sender Name',
	preview:
		'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor.',
	isRead: false,
}))

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

	const handleSnooze = useCallback((id: number) => {
		setItems((previous) => previous.filter((item) => item.id !== id))
	}, [])

	const handleTap = useCallback((id: number) => {
		setItems((previous) =>
			previous.map((item) =>
				item.id === id ? { ...item, isRead: !item.isRead } : item,
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
							<SwipeRow
								key={item.id}
								item={item}
								onArchive={handleArchive}
								onSnooze={handleSnooze}
								onTap={handleTap}
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
				component: `A bottom sheet with **nested \`useDrag\` instances**: one \`useDrag\` on the whole sheet (auto-detects the scrollable list inside, so it drives both vertical scroll and pull-to-close drag), plus one per row for horizontal swipe-to-archive/snooze (Apple Mail / Gmail style). Both levels are spread the natural way — single \`elementProps\` on the wrapper, single \`elementProps\` per row.

The hook itself coordinates the nesting via a small module-level singleton: on \`pointerdown\` no one captures yet; on the first move past the threshold the **innermost hook evaluates first** (React's natural pointer-event bubble order). If the innermost claims the gesture (e.g. row's horizontal \`shouldStart\` returns \`true\`), it captures and outers stand down. If it doesn't claim (vertical on a row), the gesture bubbles to the outer hook, which can then claim itself (scroll mode, or pull-to-close drag at the scroll edge).

Behavior to try:

- Drag the handle bar → sheet drags down.
- Pull down on the content with items at the very top → sheet drags (rubber-band edge).
- Scroll the list → vertical gesture on either content padding or a row enters scroll mode.
- Swipe a row right → archive; swipe left → snooze.
- Clear everything → empty content area still drags the sheet (no scrollable to defer to).

${sourceLink('BottomSheet.stories.tsx')}`,
			},
		},
	},
}

export default meta

export const Default: StoryObj<typeof BottomSheet> = {}
