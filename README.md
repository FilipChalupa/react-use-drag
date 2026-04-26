# React use drag [![npm](https://img.shields.io/npm/v/react-use-drag.svg)](https://www.npmjs.com/package/react-use-drag) ![npm type definitions](https://img.shields.io/npm/types/react-use-drag.svg)

Drag interactions made easier. Lightweight, React hook-based, and powered by Pointer Events for seamless mouse and touch support.

[Storybook demo](https://filipchalupa.cz/react-use-drag/).

![UI example](https://raw.githubusercontent.com/FilipChalupa/react-use-drag/HEAD/screencast.gif)

## Table of Contents

- [Installation](#installation)
- [How to use](#how-to-use)
- [CSS requirements](#css-requirements)
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

## CSS requirements

The hook works with native Pointer Events but the browser may try to claim the same gesture for native scrolling/panning. `touch-action` tells the browser to leave the gesture alone.

### Plain drag (no scrollable descendants)

```css
.draggable {
	touch-action: none;
}
```

Without it, vertical/horizontal swipes get hijacked by the browser as page scroll on touch devices.

### Scroll-aware drag (auto-detect)

When the draggable contains a scrollable descendant (e.g. a card with overflowing content), the hook auto-detects it and switches to a manual scroll mode on touch/pen — the browser must stay out of the way:

```css
.drag-root {
	touch-action: none;
}

.scrollable-descendant {
	overflow: auto; /* or overflow-y: auto, overflow-x: auto */
	touch-action: none;
}
```

The scrollable descendant needs `overflow: auto` (or `scroll`) so `findScrollableAncestor` recognizes it. Both elements need `touch-action: none` so the browser doesn't dispatch `pointercancel` mid-gesture once it commits to native pan. The hook drives the scroll itself, including momentum on release and a dominant-axis lock for diagonal gestures.

### Custom `shouldStart` without a scrollable subtree

If you provide `shouldStart` and there's no scrollable descendant for the hook to defer to, returning `false` releases the pointer and lets the browser take over — set `touch-action` to whatever native gesture you want as the fallback (`pan-y` for vertical scroll, `pan-x` for horizontal, etc.):

```css
.drag-root {
	touch-action: pan-y; /* drag wins for some gestures, native vertical scroll for others */
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
| `shouldStart`              | `(firstMove: Position, info: { pointerType: string }) => boolean` | Optional escape hatch. Evaluated on the first pointermove past a few-pixel threshold. Return `true` to take over the gesture as a drag, `false` to defer it (the hook then either takes over scroll manually if there's a scrollable subtree, or releases the pointer for native behavior). When omitted, the hook auto-detects: on `pointerdown` it walks from the event target up to the drag root looking for a scrollable element. If found and the input is touch/pen, the gesture is held back until the first move; the verdict picks drag (scroll is at the gesture-direction edge) or scroll (otherwise). Mouse always drags immediately. The scrollable element should have `touch-action: none` so the browser doesn't fight the hook for the gesture; the hook drives the scroll itself, including momentum on release and a dominant-axis lock for diagonal gestures. |

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
