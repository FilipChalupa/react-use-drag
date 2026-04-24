import type { Meta, StoryObj } from '@storybook/react'
import { useCallback, useState } from 'react'
import { useDrag } from '../src/index'
import './styles.css'

const AnyDirection = () => {
	const [position, setPosition] = useState({ x: 0, y: 0 })
	const [positionOffset, setPositionOffset] = useState({ x: 0, y: 0 })
	const onRelativePositionChange = useCallback((x: number, y: number) => {
		setPositionOffset({ x, y })
	}, [])
	const onStart = useCallback(() => {
		console.log('Dragging has started')
	}, [])
	const onEnd = useCallback((x: number, y: number) => {
		console.log('Dragging has ended')
		setPosition((position) => ({
			x: position.x + x,
			y: position.y + y,
		}))
		setPositionOffset({ x: 0, y: 0 })
	}, [])
	const { elementProps, isMoving } = useDrag({
		onRelativePositionChange,
		onStart,
		onEnd,
	})

	return (
		<button
			className="draggable"
			style={
				{
					'--x': `${position.x + positionOffset.x}px`,
					'--y': `${position.y + positionOffset.y}px`,
				} as React.CSSProperties
			}
			{...elementProps}
		>
			{isMoving ? '🚶' : '🧍'}
		</button>
	)
}

const meta: Meta<typeof AnyDirection> = {
	title: 'useDrag/Any Direction',
	component: AnyDirection,
	parameters: {
		layout: 'centered',
	},
}

export default meta

export const Default: StoryObj<typeof AnyDirection> = {}
