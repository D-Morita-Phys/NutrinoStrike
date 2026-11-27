import { describe, expect, it } from "vitest";
import {
  DETECTOR_IDS,
  createDetector,
  isDetectorId,
} from "../detectors.ts";
import {
  clampVolume,
  parseStoredVolume,
  serializeVolume,
  DEFAULT_VOLUME,
} from "../audio.ts";

const WIDTH = 480;
const HEIGHT = 720;

describe("createDetector", () => {
  it("builds the detector with the requested id", () => {
    for (const id of DETECTOR_IDS) {
      expect(createDetector(id, WIDTH, HEIGHT).id).toBe(id);
    }
  });

  it("centers the detector horizontally", () => {
    const d = createDetector("superK", WIDTH, HEIGHT);
    expect(d.x).toBeCloseTo(WIDTH / 2, 6);
  });

  it("anchors the detector near the top of the field (y ~= height*0.22)", () => {
    // The detector sits at the back/far vanishing point; this y is the nominal
    // draw anchor the renderer uses as the far target.
    const d = createDetector("kamland", WIDTH, HEIGHT);
    expect(d.y).toBeCloseTo(HEIGHT * 0.22, 6);
  });

  it("has a sane radius for the field size", () => {
    const d = createDetector("superK", WIDTH, HEIGHT);
    expect(d.radius).toBeGreaterThanOrEqual(44);
    expect(d.radius).toBeLessThan(Math.min(WIDTH, HEIGHT) / 2);
  });

  it("carries the correct cosmetic labels per id", () => {
    expect(createDetector("kamland", WIDTH, HEIGHT).label).toBe("KamLAND");
    expect(createDetector("superK", WIDTH, HEIGHT).label).toBe(
      "Super-Kamiokande",
    );
  });
});

describe("isDetectorId", () => {
  it("accepts the known ids and rejects others", () => {
    expect(isDetectorId("superK")).toBe(true);
    expect(isDetectorId("kamland")).toBe(true);
    expect(isDetectorId("nope")).toBe(false);
  });
});

describe("volume persistence helpers", () => {
  it("clamps into [0,1] and maps NaN to 0", () => {
    expect(clampVolume(-0.5)).toBe(0);
    expect(clampVolume(1.5)).toBe(1);
    expect(clampVolume(0.42)).toBe(0.42);
    expect(clampVolume(Number.NaN)).toBe(0);
  });

  it("serializes a clamped volume to a string", () => {
    expect(serializeVolume(0.5)).toBe("0.5");
    expect(serializeVolume(2)).toBe("1");
  });

  it("parses stored values, falling back on missing/invalid input", () => {
    expect(parseStoredVolume("0.3")).toBeCloseTo(0.3, 6);
    expect(parseStoredVolume("5")).toBe(1);
    expect(parseStoredVolume(null)).toBe(DEFAULT_VOLUME);
    expect(parseStoredVolume("not-a-number")).toBe(DEFAULT_VOLUME);
    expect(parseStoredVolume(null, 0.2)).toBe(0.2);
  });
});
