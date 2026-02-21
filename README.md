# React use drag [![npm](https://img.shields.io/npm/v/react-use-drag.svg)](https://www.npmjs.com/package/react-use-drag) ![npm type definitions](https://img.shields.io/npm/types/react-use-drag.svg)

Drag interactions made easier. Lightweight, React hook-based, and powered by Pointer Events for seamless mouse and touch support.

Try interactive [CodeSandbox demo](https://codesandbox.io/p/sandbox/react-use-drag-trjpqp?file=%2Fsrc%2FApp.js).

![UI example](https://raw.githubusercontent.com/FilipChalupa/react-use-drag/HEAD/screencast.gif)

## Table of Contents

- [Installation](#installation)
- [How to use](#how-to-use)
- [API Reference](#api-reference)
  - [Options](#options)
  - [Return Value](#return-value)
- [Features](#features)
- [License](#license)

## Installation

```bash
npm install react-use-drag
```

## How to use

```jsx
import { useDrag } from 'react-use-drag'
import { useState, useCallback } from 'react'

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
		setPosition((pos) => ({
			x: pos.x + x,
			y: pos.y + y,
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
				transform: `translate(${position.x + positionOffset.x}px, ${position.y + positionOffset.y}px)`,
				touchAction: 'none' // Recommended for mobile support
			}}
			{...elementProps}
		>
			{isMoving ? '🚶' : '🧍'}
		</button>
	)
}
```

## API Reference

### `useDrag(options)`

#### Options

| Property | Type | Description |
| :--- | :--- | :--- |
| `onRelativePositionChange` | `(x: number, y: number) => void` | **Required.** Called when the position changes during dragging. `x` and `y` are relative to the start position. |
| `onStart` | `() => void` | Optional. Called when the dragging interaction starts. |
| `onEnd` | `(x: number, y: number) => void` | Optional. Called when the dragging interaction ends. Receives final relative `x` and `y`. |

#### Return Value

An object containing:

| Property | Type | Description |
| :--- | :--- | :--- |
| `isMoving` | `boolean` | `true` if a drag interaction is currently active. |
| `elementProps` | `object` | Props to be spread onto the target element. Contains `onPointerDown`, `onPointerUp`, `onPointerMove`, and `onPointerCancel`. |

## Features

- **Pointer Events:** Works with Mouse, Touch, and Pen out of the box.
- **Lightweight:** Zero dependencies (other than React) and tiny bundle size.
- **Predictable:** Simple API based on relative position changes.
- **TypeScript:** Fully typed for a great developer experience.

## License

ISC
