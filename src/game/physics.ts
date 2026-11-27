// Lightweight self-written physics for the neutrino ball.
//
// Pure of the DOM: this module only knows about numbers, a 2D vector, the Ball
// state, and the play-field bounds. Rendering and input live elsewhere.
//
// Motion model: the ball flies straight from the FRONT (near the player,
// depth 0) into DEPTH toward the detector shown at the BACK (depth 1). There is
// NO gravity, NO parabola, NO falling and NO aiming direction: a shot depends
// only on the pull MAGNITUDE and always travels toward the target. A stronger
// pull advances depth faster, so it reaches the back sooner. The shot resolves
// the instant depth reaches the detector plane (1). The drag -> depth-speed
// mapping and the integrator live here so the gameplay-feel knobs sit in one
// place and the pure helpers can be unit tested.

// ---------------------------------------------------------------------------
// TUNABLE CONSTANTS
//
// All gameplay-feel numbers live here so balance can be adjusted in one place.
// Depth is a unitless 0..1 progress; time is in seconds.
// ---------------------------------------------------------------------------

/**
 * Maximum pull distance in pixels. A drag at or beyond this maps to full
 * strength for both the depth-advance speed and the neutrino energy. Shared
 * with the lottery so pull distance -> energy and pull distance -> speed stay
 * in sync (both normalize drag magnitude against MAX_PULL and clamp to 0..1).
 */
export const MAX_PULL = 220;

/**
 * Depth units per second at the weakest usable pull.
 *
 * Depth runs 0 (front) -> 1 (back/detector plane), so a speed of 1 crosses the
 * whole field in one second. This floor keeps even the faintest pull moving
 * forward at a visible rate so every shot still reaches the detector and runs
 * the lottery; a zero-length drag launches nothing. This is a SPEED knob only
 * and does not touch pullToEnergy, so the pull-strength -> energy-band mapping
 * (weak = low band, strong = high band) is unchanged.
 */
export const MIN_DEPTH_SPEED = 0.9;

/** Depth units per second at full pull strength (reaches the back fastest). */
export const MAX_DEPTH_SPEED = 2.6;

/** Depth value at which the ball has reached the detector plane (the back). */
export const DETECTOR_DEPTH = 1;

/** Ball radius in pixels. */
export const BALL_RADIUS = 16;

/** A simple 2D vector. */
export interface Vec2 {
  x: number;
  y: number;
}

/** Rectangular play-field bounds the ball flies inside of. */
export interface Bounds {
  readonly width: number;
  readonly height: number;
}

/**
 * Mutable ball state.
 *
 * `depth` is the primary motion axis (0 = front/near, 1 = back/detector plane).
 * `depthSpeed` is how many depth units the ball advances per second while in
 * flight; it is 0 at home and set from the pull magnitude at launch.
 *
 * `pos`/`vel`/`radius` are retained in canvas space for the renderer and for
 * any residual 2D geometry (e.g. where to draw the ball). Motion no longer
 * integrates `vel`; the renderer derives the drawn position from `depth`.
 */
export interface Ball {
  pos: Vec2;
  vel: Vec2;
  /** Flight progress along the depth axis: 0 at the front, 1 at the back. */
  depth: number;
  /** Depth units advanced per second while in flight (0 at home). */
  depthSpeed: number;
  readonly radius: number;
}

/** Create a ball at rest at the front (depth 0) at the given position. */
export function createBall(x: number, y: number): Ball {
  return {
    pos: { x, y },
    vel: { x: 0, y: 0 },
    depth: 0,
    depthSpeed: 0,
    radius: BALL_RADIUS,
  };
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Euclidean length of a drag vector. */
export function dragDistance(drag: Vec2): number {
  return Math.hypot(drag.x, drag.y);
}

/**
 * Normalized pull strength in [0, 1] from a drag distance.
 *
 * This is the SAME clamped `distance / maxPull` normalization the lottery uses
 * in pullToEnergy, exposed so the pull gauge, energy and depth-speed all agree
 * on how far "full pull" is. Strength depends only on the drag MAGNITUDE, never
 * its direction.
 */
export function pullStrength(
  pullDistance: number,
  maxPull: number = MAX_PULL,
): number {
  if (!(maxPull > 0)) return 0;
  return clamp(pullDistance / maxPull, 0, 1);
}

/**
 * Map a pull distance to the ball's depth-advance speed (depth units/second).
 *
 * Magnitude only: there is no direction. The speed is interpolated from
 * MIN_DEPTH_SPEED (weakest usable pull) up to MAX_DEPTH_SPEED (full pull) using
 * the clamped pull strength, so a stronger pull strictly advances faster and
 * reaches the back sooner. A zero-length drag yields 0 (nothing launches).
 *
 * @param pullDistance how far the ball was pulled (drag magnitude, pixels).
 * @param maxPull pull distance mapping to full strength. Defaults to MAX_PULL.
 * @param maxSpeed depth speed at full strength. Defaults to MAX_DEPTH_SPEED.
 * @param minSpeed depth speed at the weakest usable pull. Defaults to
 *                 MIN_DEPTH_SPEED.
 */
export function pullToDepthSpeed(
  pullDistance: number,
  maxPull: number = MAX_PULL,
  maxSpeed: number = MAX_DEPTH_SPEED,
  minSpeed: number = MIN_DEPTH_SPEED,
): number {
  if (pullDistance <= 0 || !(maxPull > 0)) return 0;
  const strength = pullStrength(pullDistance, maxPull);
  return minSpeed + strength * (maxSpeed - minSpeed);
}

/**
 * Launch the ball from a release drag: lock in its depth-advance speed from the
 * pull MAGNITUDE and reset it to the front. Mutates and returns the ball. The
 * drag direction is ignored by design; the ball always flies toward the back.
 */
export function launchBall(
  ball: Ball,
  drag: Vec2,
  maxPull: number = MAX_PULL,
): Ball {
  ball.depth = 0;
  ball.depthSpeed = pullToDepthSpeed(dragDistance(drag), maxPull);
  return ball;
}

/**
 * Advance the ball by dt seconds along the depth axis.
 *
 * Mutates and returns the ball. No gravity, no friction, no wall bounce: depth
 * increases by depthSpeed * dt and is clamped so it never runs past the
 * detector plane. A ball with depthSpeed 0 (no launch) does not move at all,
 * no matter how many times step() is called. `bounds` is accepted for API
 * stability with the renderer but is not needed for depth motion.
 */
export function step(ball: Ball, _bounds: Bounds, dt: number): Ball {
  if (ball.depthSpeed <= 0) return ball;
  ball.depth = clamp(ball.depth + ball.depthSpeed * dt, 0, DETECTOR_DEPTH);
  return ball;
}

/**
 * Whether the ball has reached the detector plane at the back (depth >= 1).
 *
 * This is the arrival/hit predicate for the depth model: a shot resolves the
 * instant it arrives. A launched shot always arrives (there is no falling
 * short), so this becomes true after enough step() calls. A fresh ball at
 * depth 0 is NOT arrived.
 */
export function hasArrived(ball: Ball): boolean {
  return ball.depth >= DETECTOR_DEPTH;
}
