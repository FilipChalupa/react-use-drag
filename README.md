# React use drag [![npm](https://img.shields.io/npm/v/react-use-drag.svg)](https://www.npmjs.com/package/react-use-drag) ![npm type definitions](https://img.shields.io/npm/types/react-use-drag.svg)

Drag interactions made easier. Try interactive [CodeSandbox demo](https://codesandbox.io/p/sandbox/react-use-drag-trjpqp?file=%2Fsrc%2FApp.js).

![UI example](https://raw.githubusercontent.com/FilipChalupa/react-use-drag/HEAD/screencast.gif)

## Installation

```bash
npm install react-use-drag
```

## How to use

```jsx
import { useDrag } from 'react-use-drag'

const App = () => {
	const [position, setPosition] = useState({ x: 0, y: 0 })
	const [positionOffset, setPositionOffset] = useState({ x: 0, y: 0 })
	const onRelativePositionChange = useCallback((x, y) => {
		setPositionOffset({ x, y })
	}, [])
	const onStart = useCallback(() => {
		console.log('Dragging has started')
	}, [])
	const onEnd = useCallback((x, y) => {
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
			style={{
				translate: `translate(${position.x}px ${position.y}px)`,
			}}
			{...elementProps}
		>
			{isMoving ? '🚶' : '🧍'}
		</button>
	)
}
```
