import type { Meta, StoryObj } from '@storybook/react'
import { useCallback, useRef, useState } from 'react'
import {
	useDrag,
	type Position,
	type PositionWithVelocity,
} from '../src/index'
import './styles.css'

const lipsumLines = Array.from(
	{ length: 24 },
	(_, index) =>
		`${index + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`,
)

const Scrollable = () => {
	const scrollRef = useRef<HTMLDivElement>(null)
	const [position, setPosition] = useState({ x: 0, y: 0 })
	const [positionOffset, setPositionOffset] = useState({ x: 0, y: 0 })

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

	const shouldStart = useCallback(({ y }: Position) => {
		const scroll = scrollRef.current
		if (!scroll) {
			return true
		}
		// Drag the card only when the inner scroll has nowhere left to go in the
		// gesture's direction. Otherwise let native scroll consume the gesture.
		const atTop = scroll.scrollTop <= 0
		const atBottom =
			scroll.scrollTop >= scroll.scrollHeight - scroll.clientHeight - 1
		if (y > 0 && atTop) {
			return true
		}
		if (y < 0 && atBottom) {
			return true
		}
		return false
	}, [])

	const { elementProps, state } = useDrag({
		onRelativePositionChange,
		onEnd,
		shouldStart,
	})

	const x = position.x + positionOffset.x
	const y = position.y + positionOffset.y

	return (
		<div className="scrollable-canvas">
			<pre className="scrollable-readout">{`state: ${state}`}</pre>
			<div
				className="scrollable-card"
				style={{ '--x': `${x}px`, '--y': `${y}px` } as React.CSSProperties}
			>
				<div className="scrollable-content" ref={scrollRef} {...elementProps}>
					{lipsumLines.map((line) => (
						<p key={line}>{line}</p>
					))}
				</div>
			</div>
		</div>
	)
}

const meta: Meta<typeof Scrollable> = {
	title: 'useDrag/Scrollable',
	component: Scrollable,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'A draggable card with scrollable content inside. The gesture is consumed by the inner native scroll while the scroll has room to move in the gesture direction. Once the scroll hits an edge, the same direction promotes the gesture to a drag of the whole card. This is the standard bottom-sheet / "rubber band" interaction.\n\nDriven by `shouldStart` — the hook arms on pointerdown but defers `preventDefault` and pointer capture until the first move past a small threshold; the callback returns whether to take over.\n\nNote: native touch scroll only works on touch input. With a mouse, use the scroll wheel to scroll and drag at the edges to move the card.\n\n[View source on GitHub](https://github.com/FilipChalupa/react-use-drag/blob/main/stories/Scrollable.stories.tsx)',
			},
		},
	},
}

export default meta

export const Default: StoryObj<typeof Scrollable> = {}
