import type { Meta, StoryObj } from '@storybook/react'
import { useCallback, useState } from 'react'
import { useDrag } from '../src/index'
import './styles.css'

const stepped = (originalPosition: number, offsetPosition: number, stepSize: number) =>
	originalPosition + Math.round(offsetPosition / stepSize) * stepSize

const VerticalWithSteps = () => {
	const stepSize = 50
	const [position, setPosition] = useState(0)
	const [positionOffset, setPositionOffset] = useState(0)
	const onRelativePositionChange = useCallback((_x: number, y: number) => {
		setPositionOffset(y)
	}, [])
	const onEnd = useCallback(
		(_x: number, y: number) => {
			setPosition((position) => stepped(position, y, stepSize))
			setPositionOffset(0)
		},
		[stepSize],
	)
	const { elementProps } = useDrag({
		onRelativePositionChange,
		onEnd,
	})

	return (
		<button
			className="draggable"
			style={
				{
					'--y': `${stepped(position, positionOffset, stepSize)}px`,
				} as React.CSSProperties
			}
			{...elementProps}
		>
			↕️
		</button>
	)
}

const meta: Meta<typeof VerticalWithSteps> = {
	title: 'useDrag/Vertical with Steps',
	component: VerticalWithSteps,
	parameters: {
		layout: 'centered',
	},
}

export default meta

export const Default: StoryObj<typeof VerticalWithSteps> = {}
