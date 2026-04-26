# React use drag [![npm](https://img.shields.io/npm/v/react-use-drag.svg)](https://www.npmjs.com/package/react-use-drag) ![npm type definitions](https://img.shields.io/npm/types/react-use-drag.svg)

Drag interactions made easier. Lightweight, React hook-based, and powered by Pointer Events for seamless mouse and touch support.

[Storybook demo](https://filipchalupa.cz/react-use-drag/).

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

	const onRelativePositionChange = useCallback(({ x, y }) => {
		setPositionOffset({ x, y })
	}, [])

	const onStart = useCallback(() => {
		console.log('Dragging has started')
	}, [])

	const onEnd = useCallback(({ x, y }) => {
		setPosition((previousPosition) => ({
			x: previousPosition.x + x,
			y: previousPosition.y + y,
		}))
		setPositionOffset({ x: 0, y: 0 })
	}, [])

	const { elementProps, state } = useDrag({
		onRelativePositionChange,
		onStart,
		onEnd,
	})

	return (
		<button
			className="draggable"
			style={{
				transform: `translate(${position.x + positionOffset.x}px, ${
					position.y + positionOffset.y
				}px)`,
				touchAction: 'none', // Recommended for mobile support
			}}
			{...elementProps}
		>
			{state === 'resting' ? '🧍' : '🚶'}
		</button>
	)
}
```

## API Reference

### `useDrag(options)`

#### Options

| Property                   | Type                           | Description                                                                                                                                                                                                                                                              |
| :------------------------- | :----------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onRelativePositionChange` | `(position: Position) => void` | **Required.** Called when the position changes during dragging or coasting. `position.x` and `position.y` are relative to the start position. `position.velocity` holds the current velocity in pixels per second.                                                       |
| `onStart`                  | `() => void`                   | Optional. Called when the dragging interaction starts.                                                                                                                                                                                                                   |
| `onEnd`                    | `(position: Position) => void` | Optional. Called when the interaction fully ends. With `inertia` or `snapPoints` this fires only after the coasting animation settles. Receives the final relative position and velocity. On cancellation `x`, `y`, and `velocity` are `0`.                              |
| `inertia`                  | `boolean`                      | Optional. When `true`, the element keeps moving after release with friction-based deceleration until it settles.                                                                                                                                                         |
| `snapPoints`               | `Position[]`                   | Optional. Snap targets in the same coordinate space as the relative position. On release the snap point closest to the inertia projection is chosen. With `inertia` the position springs to the target absorbing release velocity; without `inertia` it teleports there. |
| `shouldStart`              | `(firstMove: Position, info: { pointerType: string }) => boolean` | Optional. Evaluated on the first pointermove past a few-pixel threshold. Return `false` to abandon the gesture so native behavior (e.g. scroll on a `pan-y` element) can continue. When omitted, the drag starts immediately on pointerdown. The second argument carries `pointerType` (`'mouse' \| 'touch' \| 'pen'`) so you can short-circuit for input modes without a native scroll fallback (typically mouse). Set `touch-action` accordingly: `none` for unconditional drag, `pan-x` / `pan-y` to preserve the corresponding native scroll fallback. |

#### `Position`

| Property   | Type                       | Description                                 |
| :--------- | :------------------------- | :------------------------------------------ |
| `x`        | `number`                   | Pixels relative to the drag start position. |
| `y`        | `number`                   | Pixels relative to the drag start position. |
| `velocity` | `{ x: number; y: number }` | Current drag velocity in pixels per second. |

#### Return Value

An object containing:

| Property       | Type                                    | Description                                                                                                                                                                                                |
| :------------- | :-------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`        | `'resting' \| 'dragging' \| 'coasting'` | `'dragging'` while the user is interacting, `'coasting'` while an inertia or snap animation is settling, `'resting'` otherwise. The `'coasting'` value only appears when `inertia` or `snapPoints` is set. |
| `elementProps` | `object`                                | Props to be spread onto the target element. Contains `onPointerDown`, `onPointerUp`, `onPointerMove`, and `onPointerCancel`.                                                                               |

## Features

- **Pointer Events:** Works with Mouse, Touch, and Pen out of the box.
- **Lightweight:** Zero dependencies (other than React) and tiny bundle size.
- **Predictable:** Simple API based on relative position changes.
- **TypeScript:** Fully typed for a great developer experience.

## License

ISC
