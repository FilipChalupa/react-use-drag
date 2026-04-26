import type { Meta, StoryObj } from '@storybook/react'
import { useCallback, useState } from 'react'
import { useDrag, type PositionWithVelocity } from '../src/index'
import { sourceLink } from './sourceLink'
import './styles.css'

const lipsumLines = Array.from(
	{ length: 30 },
	(_, index) =>
		`${index + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`,
)

const BottomSheet = () => {
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

	const y = position.y + positionOffset.y

	return (
		<div className="bottom-sheet-canvas">
			<pre className="bottom-sheet-readout">{`state: ${state}`}</pre>
			<div
				className="bottom-sheet"
				style={{ '--y': `${y}px` } as React.CSSProperties}
			>
				<div className="bottom-sheet-handle" {...elementProps} />
				<div className="bottom-sheet-content" {...elementProps}>
					{lipsumLines.map((line) => (
						<p key={line}>{line}</p>
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
				component: `A vertically scrollable card pinned to the bottom — the classic mobile bottom-sheet pattern. The handle bar at the top drags unconditionally (no scrollable subtree under it). The content area auto-defers to native vertical scroll until it reaches an edge; pulling down at the top of the content then drags the whole sheet down.\n\nNo \`shouldStart\` needed — the hook walks from the touch target up looking for a scrollable element and applies the bottom-sheet rule automatically. The content needs \`touch-action: pan-y\` and \`overscroll-behavior-y: contain\` so iOS/Android pull-to-refresh doesn't steal the gesture.\n\n${sourceLink('BottomSheet.stories.tsx')}`,
			},
		},
	},
}

export default meta

export const Default: StoryObj<typeof BottomSheet> = {}
