import type { Meta, StoryObj } from '@storybook/react'
import { useCallback, useState } from 'react'
import { useDrag, type PositionWithVelocity } from '../src/index'
import { sourceLink } from './sourceLink'
import './styles.css'

const stepped = (
	originalPosition: number,
	offsetPosition: number,
	stepSize: number,
) => originalPosition + Math.round(offsetPosition / stepSize) * stepSize

const HorizontalWithSteps = () => {
	const stepSize = 50
	const [position, setPosition] = useState(0)
	const [positionOffset, setPositionOffset] = useState(0)
	const onRelativePositionChange = useCallback(
		({ x }: PositionWithVelocity) => {
			setPositionOffset(x)
		},
		[],
	)
	const onEnd = useCallback(
		({ x }: PositionWithVelocity) => {
			setPosition((position) => stepped(position, x, stepSize))
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
					'--x': `${stepped(position, positionOffset, stepSize)}px`,
				} as React.CSSProperties
			}
			{...elementProps}
		>
			↔️
		</button>
	)
}

const meta: Meta<typeof HorizontalWithSteps> = {
	title: 'useDrag/Horizontal with Steps',
	component: HorizontalWithSteps,
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
		docs: {
			description: {
				component: `Drag the button left or right. The position snaps to a 50 px grid — it jumps in discrete steps both during the drag and when released. Vertical movement is ignored.\n\n${sourceLink('HorizontalWithSteps.stories.tsx')}`,
			},
		},
	},
}

export default meta

export const Default: StoryObj<typeof HorizontalWithSteps> = {}
