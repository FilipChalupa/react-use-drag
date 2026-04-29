import type { Meta, StoryObj } from '@storybook/react'
import { useCallback, useState } from 'react'
import { sourceLink } from './sourceLink'
import { SwipeRow, type MailItem } from './SwipeRow'
import './styles.css'

const initialMail: MailItem[] = [
	{
		id: 1,
		subject: 'Team standup notes',
		sender: 'Jana Nováková',
		preview:
			"Here are the key takeaways from today's standup — please review before tomorrow.",
		isRead: false,
	},
	{
		id: 2,
		subject: 'Invoice #1042 due Friday',
		sender: 'Billing',
		preview: 'Please process payment before the end of the week.',
		isRead: false,
	},
	{
		id: 3,
		subject: 'PR review requested',
		sender: 'GitHub',
		preview:
			'FilipChalupa requested your review on "feat: add swipe-to-reveal story".',
		isRead: false,
	},
	{
		id: 4,
		subject: 'You have a new follower',
		sender: 'GitHub',
		preview: 'Someone started following your repository.',
		isRead: true,
	},
	{
		id: 5,
		subject: 'Weekly digest',
		sender: 'Substack',
		preview:
			"Here's what happened this week in your subscriptions. Plus: top reads.",
		isRead: false,
	},
]

const SwipeToReveal = () => {
	const [items, setItems] = useState(initialMail)
	const [archived, setArchived] = useState(0)
	const [snoozed, setSnoozed] = useState(0)

	const handleArchive = useCallback((id: number) => {
		setItems((previous) => previous.filter((item) => item.id !== id))
		setArchived((n) => n + 1)
	}, [])

	const handleSnooze = useCallback((id: number) => {
		setItems((previous) => previous.filter((item) => item.id !== id))
		setSnoozed((n) => n + 1)
	}, [])

	const handleTap = useCallback((id: number) => {
		setItems((previous) =>
			previous.map((item) =>
				item.id === id ? { ...item, isRead: true } : item,
			),
		)
	}, [])

	return (
		<div className="swipe-list-canvas">
			<div className="swipe-list-card">
				{items.length > 0 ? (
					items.map((item) => (
						<SwipeRow
							key={item.id}
							item={item}
							onArchive={handleArchive}
							onSnooze={handleSnooze}
							onTap={handleTap}
						/>
					))
				) : (
					<div className="swipe-list-empty">Inbox zero ✓</div>
				)}
			</div>
			<div className="swipe-list-counters">
				<span className="swipe-list-counter swipe-list-counter-archive">
					Archived: {archived}
				</span>
				<span className="swipe-list-counter swipe-list-counter-snooze">
					Snoozed: {snoozed}
				</span>
			</div>
		</div>
	)
}

const meta: Meta<typeof SwipeToReveal> = {
	title: 'useDrag/Swipe to Reveal',
	component: SwipeToReveal,
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
		docs: {
			description: {
				component: `A classic mobile inbox pattern: swipe a row **right** to reveal the green **Archive** action, swipe **left** to reveal the orange **Snooze** action. Release past the threshold to trigger; release early to snap back.

Each row is its own \`useDrag\` instance. The \`shouldStart\` callback ensures only horizontal-dominant gestures are captured.

**Works inside a scrollable container.** When \`shouldStart\` is provided, the hook never auto-detects a scrollable ancestor — so vertical scroll has to come from the browser directly. That's why the row uses \`touch-action: pan-y\` instead of \`touch-action: none\`: the browser owns vertical panning, the hook owns horizontal swipes. For a purely horizontal gesture the hook calls \`setPointerCapture\` before the browser can intervene; for a vertical one it releases cleanly and the browser takes over.

${sourceLink('SwipeToReveal.stories.tsx')}`,
			},
		},
	},
}

export default meta

export const Default: StoryObj<typeof SwipeToReveal> = {}
