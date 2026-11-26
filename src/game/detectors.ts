// Detector targets: Super-Kamiokande and KamLAND.
//
// Pure of the DOM: detectors are plain geometry (circle position + radius) plus
// display metadata. Rendering draws them; the game loop hit-tests the ball
// against them.
//
// Flavor note on theming: KamLAND is themed to the LOW-energy regime (reactor /
// geoneutrinos) and Super-Kamiokande to the HIGH-energy regime (atmospheric /
// accelerator). The theme is cosmetic only. The observed species is ALWAYS
// decided by the lottery using the launch energy derived from pull strength
// (pull strength -> energy -> band -> weighted draw), never by which detector
// was hit.

import type { Ball } from "./physics.ts";

/** Machine id for a detector. */
export type DetectorId = "superK" | "kamland";

/** A circular detector target on the play field. */
export interface Detector {
  readonly id: DetectorId;
  /** Center x in canvas pixels. */
  readonly x: number;
  /** Center y in canvas pixels. */
  readonly y: number;
  /** Radius in canvas pixels. */
  readonly radius: number;
  /** English label drawn on the target. */
  readonly label: string;
  /** Japanese label drawn under the English one. */
  readonly labelJa: string;
  /** Cosmetic theme color. */
  readonly color: string;
  /** Short flavor hint about the energy regime this detector evokes. */
  readonly theme: string;
}

/**
 * Build the two detector targets for a given play-field size. Both sit in the
 * upper portion of the field so the ball, launched upward, flies into them.
 */
export function createDetectors(width: number, height: number): Detector[] {
  const radius = Math.max(44, Math.min(width, height) * 0.11);
  const y = height * 0.22;
  return [
    {
      id: "kamland",
      x: width * 0.3,
      y,
      radius,
      label: "KamLAND",
      labelJa: "カムランド",
      color: "#4fc3f7",
      theme: "low-energy (reactor / geo)",
    },
    {
      id: "superK",
      x: width * 0.7,
      y,
      radius,
      label: "Super-Kamiokande",
      labelJa: "スーパーカミオカンデ",
      color: "#81c784",
      theme: "high-energy (atmospheric / accelerator)",
    },
  ];
}

/** True when the ball overlaps the detector circle. */
export function hitTest(detector: Detector, ball: Ball): boolean {
  const dist = Math.hypot(ball.pos.x - detector.x, ball.pos.y - detector.y);
  return dist <= detector.radius + ball.radius;
}

/**
 * Return the first detector the ball overlaps, or null if none. Order follows
 * the array, which is fine since detectors do not overlap.
 */
export function detectorHit(
  detectors: readonly Detector[],
  ball: Ball,
): Detector | null {
  for (const d of detectors) {
    if (hitTest(d, ball)) return d;
  }
  return null;
}
