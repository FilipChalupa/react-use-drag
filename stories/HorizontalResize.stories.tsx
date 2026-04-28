import type { Meta, StoryObj } from '@storybook/react'
import { useCallback, useState } from 'react'
import { useDrag, type PositionWithVelocity } from '../src/index'
import { sourceLink } from './sourceLink'
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
	const onRelativeLeftChange = useCallback(({ x }: PositionWithVelocity) => {
		setLeftOffset(x)
	}, [])
	const onRelativeRightChange = useCallback(({ x }: PositionWithVelocity) => {
		setRightOffset(x)
	}, [])
	const onLeftEnd = useCallback(
		({ x }: PositionWithVelocity) => {
			setLeft((position) => limitLeft(position, x, right))
			setLeftOffset(0)
		},
		[right],
	)
	const onRightEnd = useCallback(
		({ x }: PositionWithVelocity) => {
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
				<button
				onClick={() => {
					alert('You have clicked the left side!')
				}}
				{...leftElementProps}>←</button>
				<button
				onClick={() => {
					alert('You have clicked the right side!')
				}}
				{...rightElementProps}>→</button>
			</div>
		</div>
	)
}

const meta: Meta<typeof HorizontalResize> = {
	title: 'useDrag/Horizontal Resize',
	component: HorizontalResize,
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
		docs: {
			description: {
				component: `Two independent drag handles resize a box. The ← handle extends the left edge, the → handle extends the right edge. Neither handle can cross the other — \`Math.min\`/\`Math.max\` clamps keep them apart. Each handle uses its own \`useDrag\` instance.\n\n${sourceLink('HorizontalResize.stories.tsx')}`,
			},
		},
	},
}

export default meta

export const Default: StoryObj<typeof HorizontalResize> = {}
