import type { Preview } from '@storybook/react'

const preview: Preview = {
	parameters: {
		layout: 'centered',
		docs: {
			canvas: {
				sourceState: 'none',
			},
		},
	},
}

export default preview
