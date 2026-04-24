import type { Meta, StoryObj } from '@storybook/react'
import { useCallback, useState } from 'react'
import { useDrag } from '../src/index'
import './styles.css'

const limitLeft = (left: number, leftOffset: number, right: number) =>
	Math.min(left + leftOffset, right)
const limitRight = (right: number, rightOffset: number, left: number) =>
	Math.max(right + rightOffset, left)

const HorizontalResize = () => {
	const [left, setLeft] = useState(0)
	const [right, setRight] = useState(0)
	const [leftOffset, setLeftOffset] = useState(0)
	const [rightOffset, setRightOffset] = useState(0)
	const onRelativeLeftChange = useCallback((x: number) => {
		setLeftOffset(x)
	}, [])
	const onRelativeRightChange = useCallback((x: number) => {
		setRightOffset(x)
	}, [])
	const onLeftEnd = useCallback(
		(x: number) => {
			setLeft((position) => limitLeft(position, x, right))
			setLeftOffset(0)
		},
		[right],
	)
	const onRightEnd = useCallback(
		(x: number) => {
			setRight((position) => limitRight(position, x, left))
			setRightOffset(0)
		},
		[left],
	)
	const { elementProps: leftElementProps } = useDrag({
		onRelativePositionChange: onRelativeLeftChange,
		onEnd: onLeftEnd,
	})
	const { elementProps: rightElementProps } = useDrag({
		onRelativePositionChange: onRelativeRightChange,
		onEnd: onRightEnd,
	})

	return (
		<div className="resize-wrapper">
			<div
				className="resize"
				style={
					{
						'--left': `${limitLeft(left, leftOffset, right)}px`,
						'--right': `${limitRight(right, rightOffset, left)}px`,
					} as React.CSSProperties
				}
			>
				<button {...leftElementProps}>←</button>
				<button {...rightElementProps}>→</button>
			</div>
		</div>
	)
}

const meta: Meta<typeof HorizontalResize> = {
	title: 'useDrag/Horizontal Resize',
	component: HorizontalResize,
	parameters: {
		layout: 'centered',
	},
}

export default meta

export const Default: StoryObj<typeof HorizontalResize> = {}
