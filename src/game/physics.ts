// Lightweight self-written physics for the neutrino ball.
//
// Pure of the DOM: this module only knows about numbers, a 2D vector, the Ball
// state, and the play-field bounds. Rendering and input live elsewhere. The
// drag -> velocity mapping and the integrator are kept here so the gameplay-feel
// knobs sit in one place and the pure helpers can be unit tested.

// ---------------------------------------------------------------------------
// TUNABLE CONSTANTS
//
// All gameplay-feel numbers live here so balance can be adjusted in one place.
// Units are canvas pixels and seconds.
// ---------------------------------------------------------------------------

/** Downward acceleration applied every step, in pixels / second^2. */
export const GRAVITY = 900;

/** Velocity retained after a wall bounce (0 = dead stop, 1 = perfect bounce). */
export const WALL_DAMPING = 0.7;

/** Per-second velocity retention from air drag / friction (0..1). */
export const FRICTION = 0.5;

/**
 * Maximum pull distance in pixels. A drag at or beyond this maps to full
 * strength for both the launch speed and the neutrino energy. Shared with the
 * lottery so pull distance -> energy and pull distance -> speed stay in sync.
 */
export const MAX_PULL = 220;

/** Launch speed in pixels/second at full pull strength. */
export const MAX_LAUNCH_SPEED = 1600;

/** Ball radius in pixels. */
export const BALL_RADIUS = 16;

/** Below this speed (pixels/second) the ball is considered at rest. */
export const REST_SPEED = 18;

/** A simple 2D vector. */
export interface Vec2 {
  x: number;
  y: number;
}

/** Rectangular play-field bounds the ball bounces inside of. */
export interface Bounds {
  readonly width: number;
  readonly height: number;
}

/** Mutable ball state: position and velocity in canvas space. */
export interface Ball {
  pos: Vec2;
  vel: Vec2;
  readonly radius: number;
}

/** Create a ball at rest at the given position. */
export function createBall(x: number, y: number): Ball {
  return { pos: { x, y }, vel: { x: 0, y: 0 }, radius: BALL_RADIUS };
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
 * Convert a release drag vector into an initial launch velocity.
 *
 * Monster Strike-style: the player pulls the ball DOWN and releases, so the
 * ball launches in the OPPOSITE direction of the drag (pull down -> fly up).
 * The launch speed is proportional to the drag distance, normalized against
 * maxPull and clamped to [0, 1], then scaled by MAX_LAUNCH_SPEED.
 *
 * @param drag the vector from the ball to the current pointer (the pull).
 * @param maxPull pull distance mapping to full strength. Defaults to MAX_PULL.
 * @param maxSpeed launch speed at full strength. Defaults to MAX_LAUNCH_SPEED.
 */
export function dragToVelocity(
  drag: Vec2,
  maxPull: number = MAX_PULL,
  maxSpeed: number = MAX_LAUNCH_SPEED,
): Vec2 {
  const dist = dragDistance(drag);
  if (dist === 0 || !(maxPull > 0)) {
    return { x: 0, y: 0 };
  }
  const strength = clamp(dist / maxPull, 0, 1);
  const speed = strength * maxSpeed;
  // Opposite direction of the drag, unit vector scaled by speed.
  return { x: (-drag.x / dist) * speed, y: (-drag.y / dist) * speed };
}

/**
 * Advance the ball by dt seconds under gravity, friction and wall bounce.
 *
 * Mutates and returns the ball. Walls are the play-field bounds; hitting one
 * reflects the velocity and scales it by WALL_DAMPING so motion decays.
 */
export function step(ball: Ball, bounds: Bounds, dt: number): Ball {
  // Gravity.
  ball.vel.y += GRAVITY * dt;

  // Air drag / friction: exponential decay independent of frame rate.
  const retain = Math.pow(FRICTION, dt);
  ball.vel.x *= retain;
  ball.vel.y *= retain;

  // Integrate position.
  ball.pos.x += ball.vel.x * dt;
  ball.pos.y += ball.vel.y * dt;

  const r = ball.radius;

  // Left / right walls.
  if (ball.pos.x - r < 0) {
    ball.pos.x = r;
    ball.vel.x = -ball.vel.x * WALL_DAMPING;
  } else if (ball.pos.x + r > bounds.width) {
    ball.pos.x = bounds.width - r;
    ball.vel.x = -ball.vel.x * WALL_DAMPING;
  }

  // Top / bottom walls.
  if (ball.pos.y - r < 0) {
    ball.pos.y = r;
    ball.vel.y = -ball.vel.y * WALL_DAMPING;
  } else if (ball.pos.y + r > bounds.height) {
    ball.pos.y = bounds.height - r;
    ball.vel.y = -ball.vel.y * WALL_DAMPING;
  }

  return ball;
}

/** Current speed (velocity magnitude) of the ball in pixels/second. */
export function speed(ball: Ball): number {
  return Math.hypot(ball.vel.x, ball.vel.y);
}

/**
 * Whether the ball has effectively come to rest: slow and sitting on the floor.
 * Used to end a shot that never reached a detector.
 */
export function isAtRest(ball: Ball, bounds: Bounds): boolean {
  const onFloor = ball.pos.y + ball.radius >= bounds.height - 1;
  return onFloor && speed(ball) < REST_SPEED;
}
