import type { Meta, StoryObj } from '@storybook/react'
import { useCallback, useMemo, useState } from 'react'
import { useDrag, type Position, type PositionWithVelocity } from '../src/index'
import { sourceLink } from './sourceLink'
import './styles.css'

// Absolute positions on the canvas (relative to canvas center).
const snapPointPositions: Position[] = [
	{ x: -280, y: -120 },
	{ x: -160, y: -120 },
	{ x: 160, y: -120 },
	{ x: -160, y: 120 },
	{ x: -280, y: 120 },
	{ x: 160, y: 120 },
]

interface InertiaArgs {
	inertia: boolean
	useSnapPoints: boolean
}

const Inertia = ({ inertia, useSnapPoints }: InertiaArgs) => {
	const [position, setPosition] = useState({ x: 0, y: 0 })
	const [positionOffset, setPositionOffset] = useState({ x: 0, y: 0 })
	const [velocity, setVelocity] = useState({ x: 0, y: 0 })

	const onRelativePositionChange = useCallback(
		({ x, y, velocity }: PositionWithVelocity) => {
			setPositionOffset({ x, y })
			setVelocity(velocity)
		},
		[],
	)
	const onEnd = useCallback(({ x, y }: PositionWithVelocity) => {
		setPosition((previous) => ({ x: previous.x + x, y: previous.y + y }))
		setPositionOffset({ x: 0, y: 0 })
	}, [])

	// Snap points expected by useDrag are relative to the drag start (current
	// `position`). Translate the canvas-absolute targets into that frame.
	const snapPoints = useMemo(
		() =>
			useSnapPoints
				? snapPointPositions.map((point) => ({
						x: point.x - position.x,
						y: point.y - position.y,
					}))
				: undefined,
		[useSnapPoints, position.x, position.y],
	)

	const { elementProps, state } = useDrag({
		onRelativePositionChange,
		onEnd,
		inertia,
		snapPoints,
	})

	const x = position.x + positionOffset.x
	const y = position.y + positionOffset.y

	return (
		<div className="any-direction-canvas">
			<pre className="any-direction-readout">{`state: ${state}\nx: ${Math.round(
				x,
			)}\ny: ${Math.round(y)}\nvx: ${Math.round(velocity.x)}\nvy: ${Math.round(
				velocity.y,
			)}`}</pre>
			{useSnapPoints &&
				snapPointPositions.map((snapPoint, index) => (
					<div
						key={index}
						className="snap-point"
						style={
							{
								'--x': `${snapPoint.x}px`,
								'--y': `${snapPoint.y}px`,
							} as React.CSSProperties
						}
					/>
				))}
			<button
				className="draggable"
				style={{ '--x': `${x}px`, '--y': `${y}px` } as React.CSSProperties}
				{...elementProps}
			>
				{state === 'dragging' ? '🚶' : state === 'coasting' ? '💨' : '🧍'}
			</button>
		</div>
	)
}

const meta: Meta<typeof Inertia> = {
	title: 'useDrag/Inertia and Snap',
	component: Inertia,
	tags: ['autodocs'],
	args: {
		inertia: true,
		useSnapPoints: true,
	},
	argTypes: {
		inertia: {
			control: 'boolean',
			description:
				'When enabled, the element keeps moving with friction after release.',
		},
		useSnapPoints: {
			control: 'boolean',
			description:
				'When enabled, the element snaps to the nearest of four predefined points based on the inertia projection.',
		},
	},
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component: `Flick the button to see inertia decay or snap to predefined targets. Toggle \`inertia\` and snap points via the controls. With both enabled the element springs to the snap point closest to where inertia would have settled, absorbing the release velocity. With only snap points enabled it jumps directly to the chosen target. With only inertia enabled it coasts and stops on its own.\n\n${sourceLink('Inertia.stories.tsx')}`,
			},
		},
	},
}

export default meta

export const Default: StoryObj<typeof Inertia> = {}
