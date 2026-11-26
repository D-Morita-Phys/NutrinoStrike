import { describe, expect, it } from "vitest";
import {
  DETECTOR_IDS,
  createDetector,
  createDetectors,
  detectorHit,
  hitTest,
  isDetectorId,
  type DetectorId,
} from "../detectors.ts";
import { createBall } from "../physics.ts";
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

  it("places the detector near the top of the field (y ~= height*0.22)", () => {
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

  it("hit-tests true when the ball overlaps the center", () => {
    const d = createDetector("superK", WIDTH, HEIGHT);
    const ball = createBall(d.x, d.y);
    expect(hitTest(d, ball)).toBe(true);
  });

  it("hit-tests false when the ball is far away", () => {
    const d = createDetector("superK", WIDTH, HEIGHT);
    const ball = createBall(d.x, HEIGHT - 1);
    expect(hitTest(d, ball)).toBe(false);
  });

  it("is reachable via detectorHit against a single-element list", () => {
    const d = createDetector("kamland", WIDTH, HEIGHT);
    const ball = createBall(d.x, d.y);
    expect(detectorHit([d], ball)?.id).toBe("kamland");
  });
});

describe("isDetectorId", () => {
  it("accepts the known ids and rejects others", () => {
    expect(isDetectorId("superK")).toBe(true);
    expect(isDetectorId("kamland")).toBe(true);
    expect(isDetectorId("nope")).toBe(false);
  });
});

describe("createDetectors (multi-target, retained)", () => {
  it("still returns both detectors for reachability tests", () => {
    const ds = createDetectors(WIDTH, HEIGHT);
    const ids = ds.map((d) => d.id as DetectorId);
    expect(ids).toContain("superK");
    expect(ids).toContain("kamland");
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
