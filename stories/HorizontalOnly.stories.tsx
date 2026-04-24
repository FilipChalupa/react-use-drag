import type { Meta, StoryObj } from '@storybook/react'
import { useCallback, useState } from 'react'
import { useDrag } from '../src/index'
import './styles.css'

const HorizontalOnly = () => {
	const [position, setPosition] = useState(0)
	const [positionOffset, setPositionOffset] = useState(0)
	const onRelativePositionChange = useCallback((x: number) => {
		setPositionOffset(x)
	}, [])
	const onEnd = useCallback((x: number) => {
		setPosition((position) => position + x)
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
					'--x': `${position + positionOffset}px`,
				} as React.CSSProperties
			}
			{...elementProps}
		>
			↔️
		</button>
	)
}

const meta: Meta<typeof HorizontalOnly> = {
	title: 'useDrag/Horizontal Only',
	component: HorizontalOnly,
	parameters: {
		layout: 'centered',
	},
}

export default meta

export const Default: StoryObj<typeof HorizontalOnly> = {}
