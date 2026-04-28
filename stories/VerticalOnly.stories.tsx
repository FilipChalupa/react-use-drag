import type { Meta, StoryObj } from '@storybook/react'
import { useCallback, useState } from 'react'
import { useDrag, type PositionWithVelocity } from '../src/index'
import { sourceLink } from './sourceLink'
import './styles.css'

const VerticalOnly = () => {
	const [position, setPosition] = useState(0)
	const [positionOffset, setPositionOffset] = useState(0)
	const onRelativePositionChange = useCallback(
		({ y }: PositionWithVelocity) => {
			setPositionOffset(y)
		},
		[],
	)
	const onEnd = useCallback(({ y }: PositionWithVelocity) => {
		setPosition((position) => position + y)
		setPositionOffset(0)
	}, [])
	const { elementProps } = useDrag({
		onRelativePositionChange,
		onEnd,
	})

	return (
		<button
			className="draggable"
			style={
				{
					'--y': `${position + positionOffset}px`,
				} as React.CSSProperties
			}
			onClick={() => {
				alert('You have clicked me!')
			}}
			{...elementProps}
		>
			↕️
		</button>
	)
}

const meta: Meta<typeof VerticalOnly> = {
	title: 'useDrag/Vertical Only',
	component: VerticalOnly,
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
		docs: {
			description: {
				component: `Drag the button up or down. Horizontal movement is ignored — only the \`y\` value from \`onRelativePositionChange\` is applied.\n\n${sourceLink(
					'VerticalOnly.stories.tsx',
				)}`,
			},
		},
	},
}

export default meta

export const Default: StoryObj<typeof VerticalOnly> = {}
