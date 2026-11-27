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

/** Camera zoom at full approach to the detector (focal-point magnification). */
export const CAMERA_ZOOM_MAX = 2.2;

/**
 * Depth render-scale at the ball's home (bottom of the field): the ball reads
 * slightly LARGER up close.
 */
export const DEPTH_SCALE_NEAR = 1.18;

/**
 * Depth render-scale when the ball reaches the detector (top of the field): the
 * ball reads SMALLER as it recedes into depth toward the target.
 */
export const DEPTH_SCALE_FAR = 0.62;

/** Ball jitter in pixels at full charge (maps from charge intensity 0..1). */
export const MAX_CHARGE_JITTER_PX = 9;

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
 * Render scale for the launched ball based on how far it has travelled from its
 * home toward the detector. `progress` is 0 at home (near, larger) and 1 at the
 * detector (far, smaller). The scale is interpolated between DEPTH_SCALE_NEAR
 * and DEPTH_SCALE_FAR and is always strictly positive. This is a RENDER scale
 * only; ball.radius used by physics/hitTest is never changed.
 */
export function depthScale(
  progress: number,
  near: number = DEPTH_SCALE_NEAR,
  far: number = DEPTH_SCALE_FAR,
): number {
  const t = clamp01(progress);
  return near + (far - near) * t;
}

/**
 * Normalize a world y position to 0..1 flight progress between the home y
 * (progress 0) and the detector y (progress 1). Values outside the span are
 * clamped so the ball bouncing past the detector still reads as "arrived".
 */
export function flightProgress(
  ballY: number,
  homeY: number,
  detectorY: number,
): number {
  const span = homeY - detectorY;
  if (span === 0) return 0;
  return clamp01((homeY - ballY) / span);
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
