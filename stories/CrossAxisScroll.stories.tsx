import type { Meta, StoryObj } from '@storybook/react'
import { useCallback, useState } from 'react'
import { useDrag, type PositionWithVelocity } from '../src/index'
import { sourceLink } from './sourceLink'
import './styles.css'

const topLines = Array.from(
	{ length: 6 },
	(_, index) =>
		`${
			index + 1
		}. Scroll down to reach the carousel, then try both gestures over it.`,
)
const bottomLines = Array.from(
	{ length: 10 },
	(_, index) =>
		`${
			index + 7
		}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor.`,
)
const carouselCards = Array.from(
	{ length: 8 },
	(_, index) => `Card ${index + 1}`,
)

const CrossAxisScroll = () => {
	const [position, setPosition] = useState({ x: 0, y: 0 })
	const [positionOffset, setPositionOffset] = useState({ x: 0, y: 0 })

	const onRelativePositionChange = useCallback(
		({ x, y }: PositionWithVelocity) => {
			setPositionOffset({ x, y })
		},
		[],
	)
	const onEnd = useCallback(({ x, y }: PositionWithVelocity) => {
		setPosition((previous) => ({ x: previous.x + x, y: previous.y + y }))
		setPositionOffset({ x: 0, y: 0 })
	}, [])

	const { elementProps, state } = useDrag({
		onRelativePositionChange,
		onEnd,
		inertia: true,
	})

	const x = position.x + positionOffset.x
	const y = position.y + positionOffset.y

	return (
		<div className="demo-canvas">
			<pre className="readout">{`state: ${state}`}</pre>
			<div
				className="scrollable-card"
				style={{ '--x': `${x}px`, '--y': `${y}px` } as React.CSSProperties}
			>
				<div
					className="scrollable-content cross-axis-content"
					{...elementProps}
				>
					{topLines.map((line) => (
						<p key={line}>{line}</p>
					))}
					<div className="carousel">
						{carouselCards.map((card) => (
							<div className="carousel-item" key={card}>
								{card}
							</div>
						))}
					</div>
					{bottomLines.map((line) => (
						<p key={line}>{line}</p>
					))}
				</div>
			</div>
		</div>
	)
}

const meta: Meta<typeof CrossAxisScroll> = {
	title: 'useDrag/Cross-axis Scroll',
	component: CrossAxisScroll,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component: `A vertically scrollable, draggable card with a **horizontal carousel** embedded mid-content. The carousel scrolls on the X axis only; the card scrolls/drags on the Y axis. The hook resolves the scroll target **per gesture axis**, so the two never fight:

- **Vertical** drag over the carousel → the outer card scrolls (and drags to move once the list hits its edge). The horizontal-only carousel is skipped — it can't scroll vertically, so it doesn't capture the gesture.
- **Horizontal** drag over the carousel → the carousel scrolls. The outer card stays put.

Before axis-aware resolution, the nearest scrollable ancestor was picked on *either* axis: a vertical swipe over the carousel matched it (it's scrollable on X), then the hook "scrolled" its \`scrollTop\` — a no-op, since there's no vertical overflow — while still capturing the gesture, so the outer card couldn't move at all. Now a vertical gesture skips X-only scrollers and a horizontal gesture skips Y-only ones.

Both the card's content and the carousel use \`touch-action: none\` so the hook drives the scroll itself, with momentum on release. On mouse input the card always drags immediately; use the scroll wheel to scroll.

${sourceLink('CrossAxisScroll.stories.tsx')}`,
			},
		},
	},
}

export default meta

export const Default: StoryObj<typeof CrossAxisScroll> = {}
