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

/** Static display/theme metadata for each detector, independent of layout. */
interface DetectorMeta {
  readonly label: string;
  readonly labelJa: string;
  readonly color: string;
  readonly theme: string;
}

const DETECTOR_META: Readonly<Record<DetectorId, DetectorMeta>> = {
  kamland: {
    label: "KamLAND",
    labelJa: "カムランド",
    color: "#4fc3f7",
    theme: "low-energy (reactor / geo)",
  },
  superK: {
    label: "Super-Kamiokande",
    labelJa: "スーパーカミオカンデ",
    color: "#81c784",
    theme: "high-energy (atmospheric / accelerator)",
  },
};

/** All selectable detector ids in display order. */
export const DETECTOR_IDS: readonly DetectorId[] = ["kamland", "superK"] as const;

/** Narrow a string to a DetectorId if it is one. */
export function isDetectorId(value: string): value is DetectorId {
  return (DETECTOR_IDS as readonly string[]).includes(value);
}

/** Radius for a detector on a field of the given size. */
function detectorRadius(width: number, height: number): number {
  return Math.max(44, Math.min(width, height) * 0.11);
}

/**
 * Build a SINGLE detector target by id, centered horizontally near the top of
 * the play field (y ~= height * 0.22). This is the lone on-field target once a
 * player has chosen a detector on the select screen. The horizontal center
 * keeps it reachable by a straight-up launch (see physics reachability tests).
 *
 * The id selects only cosmetic theme/label metadata; the observed species is
 * still always decided by the lottery from launch energy.
 */
export function createDetector(
  id: DetectorId,
  width: number,
  height: number,
): Detector {
  const meta = DETECTOR_META[id];
  return {
    id,
    x: width / 2,
    y: height * 0.22,
    radius: detectorRadius(width, height),
    label: meta.label,
    labelJa: meta.labelJa,
    color: meta.color,
    theme: meta.theme,
  };
}

/**
 * Build the two detector targets for a given play-field size. Both sit in the
 * upper portion of the field so the ball, launched upward, flies into them.
 *
 * Retained for the physics reachability tests and any multi-target view; live
 * gameplay now targets a single chosen detector via createDetector.
 */
export function createDetectors(width: number, height: number): Detector[] {
  const radius = detectorRadius(width, height);
  const y = height * 0.22;
  return [
    { id: "kamland", x: width * 0.3, y, radius, ...DETECTOR_META.kamland },
    { id: "superK", x: width * 0.7, y, radius, ...DETECTOR_META.superK },
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
