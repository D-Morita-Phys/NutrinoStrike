import { describe, expect, it } from "vitest";
import {
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_MIN,
  DEPTH_SCALE_FAR,
  DEPTH_SCALE_NEAR,
  chargeIntensity,
  depthScale,
  easeOutCubic,
  flightProgress,
  zoomForProgress,
} from "../effects.ts";

describe("easeOutCubic", () => {
  it("is 0 at progress 0 and 1 at progress 1", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it("clamps inputs outside 0..1", () => {
    expect(easeOutCubic(-5)).toBe(0);
    expect(easeOutCubic(5)).toBe(1);
  });

  it("is monotonically increasing between 0 and 1", () => {
    let prev = easeOutCubic(0);
    for (let i = 1; i <= 20; i++) {
      const cur = easeOutCubic(i / 20);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });
});

describe("zoomForProgress", () => {
  it("is the min zoom at launch and the max zoom at arrival", () => {
    expect(zoomForProgress(0)).toBeCloseTo(CAMERA_ZOOM_MIN, 10);
    expect(zoomForProgress(1)).toBeCloseTo(CAMERA_ZOOM_MAX, 10);
  });

  it("is monotonically increasing and stays within [min, max]", () => {
    let prev = zoomForProgress(0);
    for (let i = 1; i <= 20; i++) {
      const cur = zoomForProgress(i / 20);
      expect(cur).toBeGreaterThanOrEqual(prev);
      expect(cur).toBeGreaterThanOrEqual(CAMERA_ZOOM_MIN);
      expect(cur).toBeLessThanOrEqual(CAMERA_ZOOM_MAX);
      prev = cur;
    }
  });

  it("honors custom min/max bounds", () => {
    expect(zoomForProgress(0, 1, 3)).toBeCloseTo(1, 10);
    expect(zoomForProgress(1, 1, 3)).toBeCloseTo(3, 10);
  });
});

describe("depthScale", () => {
  it("is the near scale at home and the far scale at the detector", () => {
    expect(depthScale(0)).toBeCloseTo(DEPTH_SCALE_NEAR, 10);
    expect(depthScale(1)).toBeCloseTo(DEPTH_SCALE_FAR, 10);
  });

  it("stays strictly positive and within sane bounds across the range", () => {
    const lo = Math.min(DEPTH_SCALE_NEAR, DEPTH_SCALE_FAR);
    const hi = Math.max(DEPTH_SCALE_NEAR, DEPTH_SCALE_FAR);
    for (let i = 0; i <= 20; i++) {
      const s = depthScale(i / 20);
      expect(s).toBeGreaterThan(0);
      expect(s).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(s).toBeLessThanOrEqual(hi + 1e-9);
    }
  });

  it("clamps out-of-range progress", () => {
    expect(depthScale(-1)).toBeCloseTo(DEPTH_SCALE_NEAR, 10);
    expect(depthScale(2)).toBeCloseTo(DEPTH_SCALE_FAR, 10);
  });
});

describe("flightProgress", () => {
  // home below (larger y), detector above (smaller y): home y=600, det y=160.
  it("is 0 at home and 1 at the detector", () => {
    expect(flightProgress(600, 600, 160)).toBe(0);
    expect(flightProgress(160, 600, 160)).toBe(1);
  });

  it("is 0.5 at the midpoint", () => {
    expect(flightProgress(380, 600, 160)).toBeCloseTo(0.5, 10);
  });

  it("clamps when the ball overshoots or sits below home", () => {
    expect(flightProgress(100, 600, 160)).toBe(1);
    expect(flightProgress(700, 600, 160)).toBe(0);
  });

  it("returns 0 for a degenerate span", () => {
    expect(flightProgress(300, 300, 300)).toBe(0);
  });
});

describe("chargeIntensity", () => {
  it("is 0 with no pull and 1 at full pull", () => {
    expect(chargeIntensity(0, 220)).toBe(0);
    expect(chargeIntensity(220, 220)).toBe(1);
  });

  it("scales linearly with pull distance", () => {
    expect(chargeIntensity(110, 220)).toBeCloseTo(0.5, 10);
  });

  it("clamps beyond full pull and guards a non-positive maxPull", () => {
    expect(chargeIntensity(500, 220)).toBe(1);
    expect(chargeIntensity(100, 0)).toBe(0);
  });
});
