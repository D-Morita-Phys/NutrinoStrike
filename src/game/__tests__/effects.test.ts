import { describe, expect, it } from "vitest";
import {
  ARROW_MAX_HEAD_HALF_WIDTH_PX,
  ARROW_MAX_HEAD_LENGTH_PX,
  ARROW_MAX_LENGTH_PX,
  ARROW_MAX_THICKNESS_PX,
  ARROW_MIN_HEAD_HALF_WIDTH_PX,
  ARROW_MIN_HEAD_LENGTH_PX,
  ARROW_MIN_LENGTH_PX,
  ARROW_MIN_THICKNESS_PX,
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_MIN,
  DEPTH_SCALE_FAR,
  DEPTH_SCALE_NEAR,
  PHOTON_MAX_LIFE,
  PHOTON_MAX_SIZE,
  PHOTON_MAX_SPEED,
  PHOTON_MIN_LIFE,
  PHOTON_MIN_SIZE,
  PHOTON_MIN_SPEED,
  type Photon,
  arrowGaugeDims,
  chargeIntensity,
  convergeToTarget,
  depthScale,
  easeOutCubic,
  flightProgress,
  isPhotonDead,
  photonAlpha,
  spawnPhotonBurst,
  updatePhoton,
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
  // Motion is depth-based: flightProgress is the clamped depth (0 front, 1 back).
  it("is 0 at the front and 1 at the detector plane", () => {
    expect(flightProgress(0)).toBe(0);
    expect(flightProgress(1)).toBe(1);
  });

  it("passes a mid-flight depth straight through", () => {
    expect(flightProgress(0.5)).toBeCloseTo(0.5, 10);
    expect(flightProgress(0.25)).toBeCloseTo(0.25, 10);
  });

  it("clamps depth that overshoots the plane or dips below the front", () => {
    expect(flightProgress(1.5)).toBe(1);
    expect(flightProgress(-0.5)).toBe(0);
  });
});

describe("convergeToTarget", () => {
  it("draws at the front/home anchor (0) at depth 0 and on the detector (1) at depth 1", () => {
    expect(convergeToTarget(0)).toBe(0);
    expect(convergeToTarget(1)).toBe(1);
  });

  it("is monotonically increasing between the front and the back", () => {
    let prev = convergeToTarget(0);
    for (let i = 1; i <= 20; i++) {
      const cur = convergeToTarget(i / 20);
      expect(cur).toBeGreaterThanOrEqual(prev);
      expect(cur).toBeGreaterThanOrEqual(0);
      expect(cur).toBeLessThanOrEqual(1);
      prev = cur;
    }
  });

  it("eases out (accelerates toward the detector early)", () => {
    // Eased convergence moves past the linear midpoint by the time depth is 0.5.
    expect(convergeToTarget(0.5)).toBeGreaterThan(0.5);
  });

  it("clamps depth outside 0..1", () => {
    expect(convergeToTarget(-1)).toBe(0);
    expect(convergeToTarget(2)).toBe(1);
  });
});

describe("arrowGaugeDims", () => {
  it("equals every MIN dimension at charge 0", () => {
    const d = arrowGaugeDims(0);
    expect(d.shaftLength).toBeCloseTo(ARROW_MIN_LENGTH_PX, 10);
    expect(d.shaftThickness).toBeCloseTo(ARROW_MIN_THICKNESS_PX, 10);
    expect(d.headLength).toBeCloseTo(ARROW_MIN_HEAD_LENGTH_PX, 10);
    expect(d.headHalfWidth).toBeCloseTo(ARROW_MIN_HEAD_HALF_WIDTH_PX, 10);
  });

  it("equals every MAX dimension at charge 1", () => {
    const d = arrowGaugeDims(1);
    expect(d.shaftLength).toBeCloseTo(ARROW_MAX_LENGTH_PX, 10);
    expect(d.shaftThickness).toBeCloseTo(ARROW_MAX_THICKNESS_PX, 10);
    expect(d.headLength).toBeCloseTo(ARROW_MAX_HEAD_LENGTH_PX, 10);
    expect(d.headHalfWidth).toBeCloseTo(ARROW_MAX_HEAD_HALF_WIDTH_PX, 10);
  });

  it("grows monotonically (non-decreasing) across charge 0..1", () => {
    let prev = arrowGaugeDims(0);
    for (let i = 1; i <= 20; i++) {
      const cur = arrowGaugeDims(i / 20);
      expect(cur.shaftLength).toBeGreaterThanOrEqual(prev.shaftLength);
      expect(cur.shaftThickness).toBeGreaterThanOrEqual(prev.shaftThickness);
      expect(cur.headLength).toBeGreaterThanOrEqual(prev.headLength);
      expect(cur.headHalfWidth).toBeGreaterThanOrEqual(prev.headHalfWidth);
      prev = cur;
    }
  });

  it("clamps inputs below 0 and above 1", () => {
    const min = arrowGaugeDims(0);
    const belowZero = arrowGaugeDims(-3);
    expect(belowZero).toEqual(min);

    const max = arrowGaugeDims(1);
    const aboveOne = arrowGaugeDims(5);
    expect(aboveOne).toEqual(max);
  });

  it("returns strictly positive dimensions across the range", () => {
    for (let i = 0; i <= 20; i++) {
      const d = arrowGaugeDims(i / 20);
      expect(d.shaftLength).toBeGreaterThan(0);
      expect(d.shaftThickness).toBeGreaterThan(0);
      expect(d.headLength).toBeGreaterThan(0);
      expect(d.headHalfWidth).toBeGreaterThan(0);
    }
  });

  it("stays within the canvas above the ball home at full charge", () => {
    // Ball home y ≈ 0.82 * 720 = 590.4. The arrow grows upward from a base near
    // the ball; its total extent (shaft + head) must leave margin above y=0.
    const d = arrowGaugeDims(1);
    expect(d.shaftLength + d.headLength).toBeLessThan(590);
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

describe("spawnPhotonBurst", () => {
  /** A deterministic rng cycling through a fixed sequence of 0..1 values. */
  function seqRng(values: number[]): () => number {
    let i = 0;
    return () => values[i++ % values.length];
  }

  it("produces exactly `count` particles all starting at the origin", () => {
    const burst = spawnPhotonBurst(100, 200, 10, seqRng([0.1, 0.5, 0.7, 0.3]));
    expect(burst).toHaveLength(10);
    for (const p of burst) {
      expect(p.x).toBe(100);
      expect(p.y).toBe(200);
    }
  });

  it("gives every particle a nonzero velocity and life within range", () => {
    const burst = spawnPhotonBurst(0, 0, 50, seqRng([0.05, 0.4, 0.6, 0.9]));
    for (const p of burst) {
      expect(Math.hypot(p.vx, p.vy)).toBeGreaterThan(0);
      expect(p.life).toBeGreaterThanOrEqual(PHOTON_MIN_LIFE - 1e-9);
      expect(p.life).toBeLessThanOrEqual(PHOTON_MAX_LIFE + 1e-9);
      expect(p.life).toBe(p.maxLife);
      expect(p.size).toBeGreaterThanOrEqual(PHOTON_MIN_SIZE - 1e-9);
      expect(p.size).toBeLessThanOrEqual(PHOTON_MAX_SIZE + 1e-9);
    }
  });

  it("maps rng samples exactly to angle, speed, life and size", () => {
    // rng sequence per particle: angle, speed, life, size.
    const p = spawnPhotonBurst(10, 20, 1, seqRng([0, 1, 1, 0]))[0];
    // angle = 0 -> cos=1, sin=0; speed at rng=1 is PHOTON_MAX_SPEED.
    expect(p.vx).toBeCloseTo(PHOTON_MAX_SPEED, 10);
    expect(p.vy).toBeCloseTo(0, 10);
    // life at rng=1 -> PHOTON_MAX_LIFE; size at rng=0 -> PHOTON_MIN_SIZE.
    expect(p.maxLife).toBeCloseTo(PHOTON_MAX_LIFE, 10);
    expect(p.life).toBeCloseTo(PHOTON_MAX_LIFE, 10);
    expect(p.size).toBeCloseTo(PHOTON_MIN_SIZE, 10);
  });

  it("maps a zero speed sample to the minimum speed", () => {
    // rng sequence: angle=0, speed=0, life=0, size=0 -> speed is PHOTON_MIN_SPEED.
    const p = spawnPhotonBurst(0, 0, 1, seqRng([0, 0, 0, 0]))[0];
    expect(Math.hypot(p.vx, p.vy)).toBeCloseTo(PHOTON_MIN_SPEED, 10);
  });

  it("returns an empty array for a zero count", () => {
    expect(spawnPhotonBurst(0, 0, 0, seqRng([0.5]))).toHaveLength(0);
  });
});

describe("updatePhoton", () => {
  function photon(overrides: Partial<Photon> = {}): Photon {
    return {
      x: 0,
      y: 0,
      vx: 100,
      vy: -50,
      life: 1,
      maxLife: 1,
      size: 4,
      ...overrides,
    };
  }

  it("moves by vx*dt / vy*dt and reduces life by dt", () => {
    const p = photon({ x: 10, y: 20, vx: 100, vy: -50, life: 1 });
    updatePhoton(p, 0.1);
    expect(p.x).toBeCloseTo(10 + 100 * 0.1, 10);
    expect(p.y).toBeCloseTo(20 - 50 * 0.1, 10);
    expect(p.life).toBeCloseTo(1 - 0.1, 10);
  });

  it("decelerates the particle (mild drag) as it ages", () => {
    const p = photon({ vx: 100, vy: -50 });
    updatePhoton(p, 0.1);
    expect(Math.abs(p.vx)).toBeLessThan(100);
    expect(Math.abs(p.vy)).toBeLessThan(50);
  });

  it("returns the same mutated particle", () => {
    const p = photon();
    expect(updatePhoton(p, 0.05)).toBe(p);
  });
});

describe("photonAlpha", () => {
  function photon(life: number, maxLife: number): Photon {
    return { x: 0, y: 0, vx: 0, vy: 0, life, maxLife, size: 4 };
  }

  it("is 1 at full life and 0 at end of life", () => {
    expect(photonAlpha(photon(1, 1))).toBe(1);
    expect(photonAlpha(photon(0, 1))).toBe(0);
  });

  it("tracks the life fraction and clamps to 0..1", () => {
    expect(photonAlpha(photon(0.5, 1))).toBeCloseTo(0.5, 10);
    expect(photonAlpha(photon(2, 1))).toBe(1); // clamps above 1
    expect(photonAlpha(photon(-1, 1))).toBe(0); // clamps below 0
    expect(photonAlpha(photon(1, 0))).toBe(0); // guards a non-positive maxLife
  });
});

describe("isPhotonDead", () => {
  function photon(life: number): Photon {
    return { x: 0, y: 0, vx: 0, vy: 0, life, maxLife: 1, size: 4 };
  }

  it("is false while life remains and flips true at/after life <= 0", () => {
    expect(isPhotonDead(photon(0.01))).toBe(false);
    expect(isPhotonDead(photon(0))).toBe(true);
    expect(isPhotonDead(photon(-0.5))).toBe(true);
  });
});
