import type { Meta, StoryObj } from '@storybook/react'
import { useCallback, useMemo, useState } from 'react'
import { useDrag, type DragBounds, type PositionWithVelocity } from '../src/index'
import { sourceLink } from './sourceLink'
import './styles.css'

// Absolute bounds on the canvas (relative to canvas centre).
const ABS_MIN_X = -200
const ABS_MAX_X = 200
const ABS_MIN_Y = -100
const ABS_MAX_Y = 100

interface BoundsArgs {
	inertia: boolean
	useMinX: boolean
	useMaxX: boolean
	useMinY: boolean
	useMaxY: boolean
}

const BoundsDemo = ({
	inertia,
	useMinX,
	useMaxX,
	useMinY,
	useMaxY,
}: BoundsArgs) => {
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
		setPosition((prev) => ({ x: prev.x + x, y: prev.y + y }))
		setPositionOffset({ x: 0, y: 0 })
	}, [])

	// Bounds are in the same relative coordinate space as onRelativePositionChange
	// (relative to the drag-start position), so translate the canvas-absolute
	// limits by subtracting the element's current accumulated position.
	const bounds = useMemo(
		(): DragBounds => ({
			minX: useMinX ? ABS_MIN_X - position.x : undefined,
			maxX: useMaxX ? ABS_MAX_X - position.x : undefined,
			minY: useMinY ? ABS_MIN_Y - position.y : undefined,
			maxY: useMaxY ? ABS_MAX_Y - position.y : undefined,
		}),
		[useMinX, useMaxX, useMinY, useMaxY, position.x, position.y],
	)

	const { elementProps, state } = useDrag({
		onRelativePositionChange,
		onEnd,
		inertia,
		bounds,
	})

	const x = position.x + positionOffset.x
	const y = position.y + positionOffset.y

	return (
		<div className="demo-canvas">
			<pre className="readout">{`state: ${state}\nx: ${Math.round(x)}\ny: ${Math.round(y)}\nvx: ${Math.round(velocity.x)}\nvy: ${Math.round(velocity.y)}`}</pre>

			{useMinX && (
				<div
					className="bound-line bound-line-x"
					style={{ left: `calc(50% + ${ABS_MIN_X}px)` }}
				/>
			)}
			{useMaxX && (
				<div
					className="bound-line bound-line-x"
					style={{ left: `calc(50% + ${ABS_MAX_X}px)` }}
				/>
			)}
			{useMinY && (
				<div
					className="bound-line bound-line-y"
					style={{ top: `calc(50% + ${ABS_MIN_Y}px)` }}
				/>
			)}
			{useMaxY && (
				<div
					className="bound-line bound-line-y"
					style={{ top: `calc(50% + ${ABS_MAX_Y}px)` }}
				/>
			)}

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

const meta: Meta<typeof BoundsDemo> = {
	title: 'useDrag/Bounds',
	component: BoundsDemo,
	tags: ['autodocs'],
	args: {
		inertia: true,
		useMinX: true,
		useMaxX: true,
		useMinY: true,
		useMaxY: true,
	},
	argTypes: {
		inertia: {
			control: 'boolean',
			description:
				'When enabled the element coasts after release. If the projected endpoint would exceed a bound the element springs to that bound instead of stopping abruptly.',
		},
		useMinX: {
			control: 'boolean',
			description: 'Enable the left boundary.',
		},
		useMaxX: {
			control: 'boolean',
			description: 'Enable the right boundary.',
		},
		useMinY: {
			control: 'boolean',
			description: 'Enable the top boundary.',
		},
		useMaxY: {
			control: 'boolean',
			description: 'Enable the bottom boundary.',
		},
	},
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component: `Drag the button and observe how it stays within the orange boundary lines. Toggle individual bounds and inertia via the controls. With inertia enabled, flicking the element towards a bound causes it to spring gently to the boundary — the same physics as snapping to a snap point — rather than cutting off abruptly. Bounds are specified in the same relative coordinate space as \`onRelativePositionChange\`.\n\n${sourceLink('Bounds.stories.tsx')}`,
			},
		},
	},
}

export default meta

export const Default: StoryObj<typeof BoundsDemo> = {}
