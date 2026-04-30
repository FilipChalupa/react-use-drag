import type { Meta, StoryObj } from '@storybook/react'
import { useCallback, useMemo, useState } from 'react'
import { useDrag, type Position, type PositionWithVelocity } from '../src/index'
import { sourceLink } from './sourceLink'
import './styles.css'

// Absolute target positions on the canvas (relative to canvas center).
const targetPositions: Position[] = [
	{ x: -200, y: -100 },
	{ x: 200, y: -100 },
	{ x: 0, y: 0 },
	{ x: -200, y: 100 },
	{ x: 200, y: 100 },
]

const TranslateTo = () => {
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

	const { elementProps, state, translateTo } = useDrag({
		onRelativePositionChange,
		onEnd,
		inertia: true,
	})

	const x = position.x + positionOffset.x
	const y = position.y + positionOffset.y

	// Translate canvas-absolute targets to relative coordinates.
	const handleTargetClick = useCallback(
		(target: Position) => {
			translateTo({ x: target.x - position.x, y: target.y - position.y })
		},
		[translateTo, position.x, position.y],
	)

	const targetLabels = useMemo(
		() => ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
		[],
	)

	return (
		<div className="demo-canvas">
			<pre className="readout">{`state: ${state}\nx: ${Math.round(x)}\ny: ${Math.round(y)}`}</pre>
			{targetPositions.map((target, index) => (
				<button
					key={index}
					style={{
						position: 'absolute',
						translate: `${target.x}px ${target.y}px`,
						width: '1.5rem',
						height: '1.5rem',
						borderRadius: '50%',
						border: '2px dashed #aaa',
						background: 'transparent',
						cursor: 'pointer',
						padding: 0,
						fontSize: '0.6rem',
						color: '#aaa',
					}}
					onClick={() => handleTargetClick(target)}
					title={targetLabels[index]}
				/>
			))}
			<button
				className="draggable"
				style={{ '--x': `${x}px`, '--y': `${y}px` } as React.CSSProperties}
				onClick={() => {
					alert('You have clicked me!')
				}}
				{...elementProps}
			>
				{state === 'dragging' ? '🚶' : state === 'coasting' ? '💨' : '🧍'}
			</button>
		</div>
	)
}

const meta: Meta<typeof TranslateTo> = {
	title: 'useDrag/translateTo',
	component: TranslateTo,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component: `Demonstrates the \`translateTo\` function returned by \`useDrag\`. Click any dashed circle to spring-animate the element there. You can also drag it freely and click a target mid-flight — the animation will redirect from the current in-flight position and velocity.\n\n${sourceLink('TranslateTo.stories.tsx')}`,
			},
		},
	},
}

export default meta

export const Default: StoryObj<typeof TranslateTo> = {}
