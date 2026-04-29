import type { Position, Velocity } from './useDrag'

// Exponent k in v(t) = v0 · e^(-k·t); projected travel = v0 / k.
export const inertiaFrictionPerSecond = 6
// px/s; below this on both axes coasting is considered settled.
export const settleVelocityThreshold = 2
// px; spring is considered settled below this distance from target.
export const snapDistanceThreshold = 0.5
export const snapStiffness = 400
// Critical damping — never overshoots.
export const snapDamping = 2 * Math.sqrt(snapStiffness)
// Clamp dt so a backgrounded tab can't blow up the spring.
export const maximumSnapFrameDeltaSeconds = 0.032

/**
 * Closed-form endpoint of inertia decay: where the position would settle if
 * left to coast from `start` with `velocity` under the friction model above.
 */
export const projectInertiaEndpoint = (
	start: Position,
	velocity: Velocity,
): Position => ({
	x: start.x + velocity.x / inertiaFrictionPerSecond,
	y: start.y + velocity.y / inertiaFrictionPerSecond,
})

/**
 * Picks the snap point closest (by Euclidean distance) to a projected position.
 * Used at release time with `projectInertiaEndpoint(...)` as the projection.
 */
export const chooseSnapPoint = (
	projected: Position,
	points: Position[],
): Position => {
	let best = points[0]
	let bestDistance = Infinity
	for (const point of points) {
		const deltaX = point.x - projected.x
		const deltaY = point.y - projected.y
		const distance = deltaX * deltaX + deltaY * deltaY
		if (distance < bestDistance) {
			bestDistance = distance
			best = point
		}
	}
	return best
}
