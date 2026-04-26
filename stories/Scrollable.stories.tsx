import type { Meta, StoryObj } from '@storybook/react'
import { useCallback, useState } from 'react'
import { useDrag, type PositionWithVelocity } from '../src/index'
import './styles.css'

const lipsumLines = Array.from(
	{ length: 24 },
	(_, index) =>
		`${index + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi.`,
)

const Scrollable = () => {
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

	const { elementProps, state } = useDrag({
		onRelativePositionChange,
		onEnd,
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
				<div className="scrollable-content" {...elementProps}>
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
					'A draggable card with content that scrolls in **both directions** inside. On touch input the inner native scroll consumes the gesture while it has room to move on either axis; once the gesture extends past an edge the whole card drags. On mouse input the card always drags immediately because there is no native scroll-by-drag to defer to — use the scroll wheel and shift+wheel to scroll the content.\n\nNo `shouldStart` callback needed — the hook auto-detects the scrollable element by walking from the pointer event target up to the drag root. The element needs `touch-action: pan-x pan-y` so the browser performs the corresponding native scroll, and `overscroll-behavior: contain` so iOS/Android pull-to-refresh and scroll chaining don\'t fight the gesture.\n\n[View source on GitHub](https://github.com/FilipChalupa/react-use-drag/blob/main/stories/Scrollable.stories.tsx)',
			},
		},
	},
}

export default meta

export const Default: StoryObj<typeof Scrollable> = {}
