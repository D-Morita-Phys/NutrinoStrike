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
 * Build the SINGLE detector target by id. It is the lone on-field target once a
 * player has chosen a detector on the select screen, and it sits at the BACK of
 * the depth field: the far vanishing point the ball flies straight into. The
 * renderer (FEAT-003) places it on screen as that far target; the ball's
 * arrival is resolved by depth (see hasArrived in physics.ts), not by 2D
 * overlap. The x/y here are a nominal centered anchor for drawing.
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
