// Pure, DOM-free math helpers for the play-screen visual effects.
//
// These are DRAWING-ONLY helpers used by the Canvas renderer (src/render/game.ts).
// They never touch ball.pos, ball.radius, step() or hitTest(): the renderer
// feeds them world values and uses the results purely to transform what is
// drawn. Keeping them here (pure, no Canvas/DOM) lets Vitest exercise the math
// in the node environment while the Canvas code stays untested-by-design.

// ---------------------------------------------------------------------------
// TUNABLE CONSTANTS (visual feel)
// ---------------------------------------------------------------------------

/** Camera zoom at launch (no magnification). */
export const CAMERA_ZOOM_MIN = 1.0;

/**
 * Camera zoom at full approach to the detector (focal-point magnification).
 * Raised from 2.2 so the post-launch push-in makes the detector (the target)
 * read clearly as the main subject while the ball flies toward it. This is a
 * DRAW-ONLY transform: physics/hit resolution stay in raw world coordinates.
 */
export const CAMERA_ZOOM_MAX = 2.6;

/**
 * Depth render-scale at the front (depth 0, near the player): the ball reads
 * slightly LARGER up close.
 */
export const DEPTH_SCALE_NEAR = 1.18;

/**
 * Depth render-scale at the detector plane (depth 1, the back): the ball reads
 * SMALLER as it recedes into depth toward the target.
 */
export const DEPTH_SCALE_FAR = 0.62;

/** Ball jitter in pixels at full charge (maps from charge intensity 0..1). */
export const MAX_CHARGE_JITTER_PX = 9;

// ---------------------------------------------------------------------------
// ARROW CHARGE GAUGE (straight arrow that grows with charged energy)
// ---------------------------------------------------------------------------
//
// While dragging, the renderer draws a STRAIGHT arrow (a rectangular shaft plus
// a triangular head) pointing up toward the detector/back. Its size encodes the
// charged energy: a weak pull draws a small arrow, a full pull a clearly larger
// one. These scalar dimensions are interpolated here (pure, DOM-free) and the
// Canvas renderer only lays them out. "Straight" means this helper returns plain
// lengths/thicknesses with no curvature.

/** Shaft length (px) at charge 0 (weakest pull). */
export const ARROW_MIN_LENGTH_PX = 36;

/** Shaft length (px) at charge 1 (full pull). Sized to fit above the ball home
 * (y = 0.82 * 720 ≈ 590) without running off the top of the 720px canvas. */
export const ARROW_MAX_LENGTH_PX = 300;

/** Shaft thickness (px) at charge 0. */
export const ARROW_MIN_THICKNESS_PX = 6;

/** Shaft thickness (px) at charge 1. */
export const ARROW_MAX_THICKNESS_PX = 20;

/** Arrowhead length along the shaft (px) at charge 0. */
export const ARROW_MIN_HEAD_LENGTH_PX = 18;

/** Arrowhead length along the shaft (px) at charge 1. */
export const ARROW_MAX_HEAD_LENGTH_PX = 54;

/** Arrowhead half-width (px, half the triangle base) at charge 0. */
export const ARROW_MIN_HEAD_HALF_WIDTH_PX = 12;

/** Arrowhead half-width (px, half the triangle base) at charge 1. */
export const ARROW_MAX_HEAD_HALF_WIDTH_PX = 34;

/** Dimensions of the straight arrow charge gauge. */
export interface ArrowGaugeDims {
  /** Length of the straight rectangular shaft, in px. */
  shaftLength: number;
  /** Thickness (width) of the straight shaft, in px. */
  shaftThickness: number;
  /** Length of the triangular head along the arrow axis, in px. */
  headLength: number;
  /** Half of the triangular head's base width, in px. */
  headHalfWidth: number;
}

/**
 * Size of the STRAIGHT arrow charge gauge for a given charge.
 *
 * `charge` is the normalized pull strength (pullDistance / MAX_PULL), clamped to
 * 0..1. Each dimension is linearly interpolated between its MIN constant (at
 * charge 0) and its MAX constant (at charge 1), so every dimension is strictly
 * positive and grows monotonically as the player charges. These are scalar sizes
 * only: the shaft is straight (no curvature), so the renderer draws a rectangle
 * for the shaft and a triangle for the head from these numbers.
 */
export function arrowGaugeDims(charge: number): ArrowGaugeDims {
  const t = clamp01(charge);
  return {
    shaftLength:
      ARROW_MIN_LENGTH_PX + (ARROW_MAX_LENGTH_PX - ARROW_MIN_LENGTH_PX) * t,
    shaftThickness:
      ARROW_MIN_THICKNESS_PX +
      (ARROW_MAX_THICKNESS_PX - ARROW_MIN_THICKNESS_PX) * t,
    headLength:
      ARROW_MIN_HEAD_LENGTH_PX +
      (ARROW_MAX_HEAD_LENGTH_PX - ARROW_MIN_HEAD_LENGTH_PX) * t,
    headHalfWidth:
      ARROW_MIN_HEAD_HALF_WIDTH_PX +
      (ARROW_MAX_HEAD_HALF_WIDTH_PX - ARROW_MIN_HEAD_HALF_WIDTH_PX) * t,
  };
}

function clamp01(t: number): number {
  if (t < 0) return 0;
  if (t > 1) return 1;
  return t;
}

/**
 * Ease-out cubic on a 0..1 progress value. Returns 0 at p=0, 1 at p=1 and is
 * monotonically increasing in between. Used so the camera zoom accelerates into
 * the target rather than ramping linearly.
 */
export function easeOutCubic(p: number): number {
  const t = clamp01(p);
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

/**
 * Map a 0..1 flight progress (0 = just launched, 1 = at the detector / resolved)
 * to the camera zoom factor, eased so it accelerates toward the target. Clamped
 * to [CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX].
 */
export function zoomForProgress(
  progress: number,
  min: number = CAMERA_ZOOM_MIN,
  max: number = CAMERA_ZOOM_MAX,
): number {
  return min + easeOutCubic(progress) * (max - min);
}

/**
 * Render scale for the launched ball from its depth progress. `depth` is 0 at
 * the front (near, larger) and 1 at the detector plane (far, smaller). The
 * scale is interpolated between DEPTH_SCALE_NEAR and DEPTH_SCALE_FAR and is
 * always strictly positive. This is a RENDER scale only; ball.radius used by
 * physics/hit resolution is never changed.
 */
export function depthScale(
  depth: number,
  near: number = DEPTH_SCALE_NEAR,
  far: number = DEPTH_SCALE_FAR,
): number {
  const t = clamp01(depth);
  return near + (far - near) * t;
}

/**
 * Clamp a depth value to the 0..1 flight-progress range used by the draw
 * helpers.
 *
 * Motion is now depth-based (see physics.ts): the ball carries a `depth` in
 * [0, 1] that the renderer feeds straight into depthScale / zoomForProgress.
 * This helper just guards the range so a depth that momentarily overshoots the
 * detector plane (or dips below the front) still reads as a valid 0..1
 * progress. It replaces the old y-between-home-and-detector derivation.
 */
export function flightProgress(depth: number): number {
  return clamp01(depth);
}

/**
 * Fraction (0..1) by which the DRAWN ball position should be moved from its
 * front/home anchor toward the detector center as it recedes into depth.
 *
 * At depth 0 (front) this is 0, so the ball is drawn at its home position; at
 * depth 1 (the detector plane) this is 1, so the ball is drawn exactly on the
 * detector center (the vanishing point). It is eased so the ball appears to
 * accelerate into the distance, matching the camera push-in. Input is clamped
 * to 0..1. This is a DRAW-ONLY convergence factor; it never changes ball.pos
 * used by physics/hit resolution.
 *
 * Use it to lerp a drawn coordinate: drawn = home + (detector - home) * factor.
 */
export function convergeToTarget(depth: number): number {
  return easeOutCubic(clamp01(depth));
}

/**
 * Charge-shake intensity (0..1) from the current pull strength. `pullDistance`
 * is the drag distance and `maxPull` the distance mapping to full strength
 * (MAX_PULL), matching the aim-arrow normalization. Intensity 0 means no pull,
 * 1 means full pull.
 */
export function chargeIntensity(pullDistance: number, maxPull: number): number {
  if (!(maxPull > 0)) return 0;
  return clamp01(pullDistance / maxPull);
}

// ---------------------------------------------------------------------------
// PHOTON PARTICLE BURST (hit-time "light emitted" effect)
// ---------------------------------------------------------------------------
//
// When the ball reaches the detector, the renderer fires a radial burst of
// bright, light-colored particles to evoke the photon flash a real detector
// would register. The spawn/update MATH lives here (pure, DOM-free, injectable
// rng) so Vitest can exercise it in the node environment; the Canvas drawing
// and the particle array live in the renderer (src/render/game.ts).

/** Number of photons spawned per hit burst. */
export const PHOTON_COUNT = 28;

/** Minimum initial speed of a photon, in px/sec. */
export const PHOTON_MIN_SPEED = 90;

/** Maximum initial speed of a photon, in px/sec. */
export const PHOTON_MAX_SPEED = 300;

/** Minimum lifetime of a photon, in seconds. */
export const PHOTON_MIN_LIFE = 0.35;

/** Maximum lifetime of a photon, in seconds. */
export const PHOTON_MAX_LIFE = 0.75;

/** Minimum draw radius of a photon glow, in px. */
export const PHOTON_MIN_SIZE = 2;

/** Maximum draw radius of a photon glow, in px. */
export const PHOTON_MAX_SIZE = 6;

/**
 * Mild per-second drag applied to a photon's velocity so particles slow as
 * they fade (0 = no drag). Fraction of velocity shed per second.
 */
export const PHOTON_DRAG_PER_SEC = 1.8;

/**
 * A single photon particle. Positions/velocities are in the renderer's draw
 * coordinate space (the detector-centered zoom block). `life` counts down from
 * `maxLife` to 0; `size` is the draw radius of the glow.
 */
export interface Photon {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

/** Linear interpolate across [min, max] by t (t already in 0..1). */
function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * t;
}

/**
 * Create a radial burst of `count` photons all starting at (originX, originY).
 *
 * Each photon gets an angle spread over the full circle and a speed sampled in
 * [PHOTON_MIN_SPEED, PHOTON_MAX_SPEED], giving a nonzero velocity (vx/vy from
 * angle*speed). Life is sampled in [PHOTON_MIN_LIFE, PHOTON_MAX_LIFE] with
 * life === maxLife at spawn, and size in [PHOTON_MIN_SIZE, PHOTON_MAX_SIZE].
 *
 * `rng` is an injectable 0..1 source (defaults to Math.random) so the
 * distribution can be asserted deterministically in tests.
 */
export function spawnPhotonBurst(
  originX: number,
  originY: number,
  count: number,
  rng: () => number = Math.random,
): Photon[] {
  const photons: Photon[] = [];
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const speed = lerp(PHOTON_MIN_SPEED, PHOTON_MAX_SPEED, rng());
    const maxLife = lerp(PHOTON_MIN_LIFE, PHOTON_MAX_LIFE, rng());
    const size = lerp(PHOTON_MIN_SIZE, PHOTON_MAX_SIZE, rng());
    photons.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: maxLife,
      maxLife,
      size,
    });
  }
  return photons;
}

/**
 * Advance one photon by `dt` seconds: move by vx*dt / vy*dt, apply a mild drag
 * so it decelerates as it fades, and decrement life by dt. Mutates and returns
 * the same particle. Pure (no DOM/Canvas).
 */
export function updatePhoton(p: Photon, dt: number): Photon {
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  const drag = Math.max(0, 1 - PHOTON_DRAG_PER_SEC * dt);
  p.vx *= drag;
  p.vy *= drag;
  p.life -= dt;
  return p;
}

/** Fade factor (0..1) for a photon: full at spawn, 0 at end of life. */
export function photonAlpha(p: Photon): number {
  if (!(p.maxLife > 0)) return 0;
  return clamp01(p.life / p.maxLife);
}

/** True once a photon has used up its lifetime (life <= 0). */
export function isPhotonDead(p: Photon): boolean {
  return p.life <= 0;
}

/**
 * Extra time (seconds) the play screen lingers after the longest-lived photon
 * has faded, so the burst reads as a complete flash before the renderer hands
 * off to the result scene. Small and purely cosmetic.
 */
export const PHOTON_REVEAL_TAIL = 0.12;

/**
 * How long (in milliseconds) the play screen should keep animating a hit burst
 * before navigating to the result scene.
 *
 * The bug this guards against: resolving a shot used to navigate to the result
 * scene synchronously, which hid the play canvas and stopped the loop in the
 * same frame the photons spawned, so the burst never animated and was never
 * seen. Delaying the hand-off by at least the longest photon lifetime (plus a
 * short tail) lets the whole burst play out on the still-live play canvas.
 *
 * Derived from the photon life ceiling so it always covers the full burst even
 * if the life constants are retuned. Returned in milliseconds to match the
 * window.setTimeout the renderer schedules it with.
 */
export function photonBurstRevealMs(
  maxLifeSec: number = PHOTON_MAX_LIFE,
  tailSec: number = PHOTON_REVEAL_TAIL,
): number {
  const total = Math.max(0, maxLifeSec) + Math.max(0, tailSec);
  return Math.round(total * 1000);
}
