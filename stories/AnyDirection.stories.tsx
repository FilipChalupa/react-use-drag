import type { Meta, StoryObj } from '@storybook/react'
import { useCallback, useState } from 'react'
import { useDrag, type PositionWithVelocity } from '../src/index'
import { sourceLink } from './sourceLink'
import './styles.css'

const AnyDirection = () => {
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
	const onStart = useCallback(() => {
		console.log('Dragging has started')
	}, [])
	const onEnd = useCallback(({ x, y, velocity }: PositionWithVelocity) => {
		console.log(
			'Dragging has ended at position',
			{ x, y },
			'and velocity',
			velocity,
			'px/s',
		)
		setPosition((position) => ({
			x: position.x + x,
			y: position.y + y,
		}))
		setPositionOffset({ x: 0, y: 0 })
	}, [])
	const { elementProps, state } = useDrag({
		onRelativePositionChange,
		onStart,
		onEnd,
	})

	const x = position.x + positionOffset.x
	const y = position.y + positionOffset.y

	return (
		<div className="demo-canvas">
			<pre className="readout">{`x: ${Math.round(x)}\ny: ${Math.round(
				y,
			)}\nvx: ${Math.round(velocity.x)}\nvy: ${Math.round(velocity.y)}`}</pre>
			<button
				className="draggable"
				style={{ '--x': `${x}px`, '--y': `${y}px` } as React.CSSProperties}
				onClick={() => {
					alert('You have clicked me!')
				}}
				{...elementProps}
			>
				{state === 'resting' ? '🧍' : '🚶'}
			</button>
		</div>
	)
}

const meta: Meta<typeof AnyDirection> = {
	title: 'useDrag/Any Direction',
	component: AnyDirection,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component: `Drag the button freely in any direction. Position accumulates across drags — releasing the button locks in the new position. The icon switches between 🧍 and 🚶 while dragging, showing the \`state\` value.\n\n${sourceLink(
					'AnyDirection.stories.tsx',
				)}`,
			},
		},
	},
}

export default meta

export const Default: StoryObj<typeof AnyDirection> = {}
