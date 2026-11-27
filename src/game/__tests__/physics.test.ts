import { describe, expect, it } from "vitest";
import {
  DETECTOR_DEPTH,
  MAX_DEPTH_SPEED,
  MAX_PULL,
  MIN_DEPTH_SPEED,
  createBall,
  dragDistance,
  hasArrived,
  launchBall,
  pullStrength,
  pullToDepthSpeed,
  step,
} from "../physics.ts";

const bounds = { width: 480, height: 720 };

describe("dragDistance", () => {
  it("is the Euclidean length of the drag vector (magnitude only)", () => {
    expect(dragDistance({ x: 3, y: 4 })).toBe(5);
    expect(dragDistance({ x: 0, y: 0 })).toBe(0);
    // Direction does not matter: same magnitude, any direction -> same value.
    expect(dragDistance({ x: 0, y: 5 })).toBe(5);
    expect(dragDistance({ x: -4, y: -3 })).toBe(5);
  });
});

describe("pullStrength", () => {
  it("normalizes drag distance against MAX_PULL into 0..1", () => {
    expect(pullStrength(0, MAX_PULL)).toBe(0);
    expect(pullStrength(MAX_PULL / 2, MAX_PULL)).toBeCloseTo(0.5, 10);
    expect(pullStrength(MAX_PULL, MAX_PULL)).toBe(1);
  });

  it("clamps at MAX_PULL so an overdrawn pull is still full strength", () => {
    expect(pullStrength(MAX_PULL * 3, MAX_PULL)).toBe(1);
    expect(pullStrength(1e9, MAX_PULL)).toBe(1);
  });

  it("guards a non-positive maxPull", () => {
    expect(pullStrength(100, 0)).toBe(0);
  });
});

describe("pullToDepthSpeed", () => {
  it("is zero for a zero-length pull (nothing launches)", () => {
    expect(pullToDepthSpeed(0, MAX_PULL)).toBe(0);
  });

  it("launches the weakest usable pull at the MIN_DEPTH_SPEED floor", () => {
    // A barely-there pull still advances so even weak shots reach the back.
    expect(pullToDepthSpeed(0.0001, MAX_PULL)).toBeCloseTo(MIN_DEPTH_SPEED, 3);
  });

  it("reaches MAX_DEPTH_SPEED at full pull and caps beyond it", () => {
    expect(pullToDepthSpeed(MAX_PULL, MAX_PULL)).toBeCloseTo(MAX_DEPTH_SPEED, 10);
    expect(pullToDepthSpeed(MAX_PULL * 3, MAX_PULL)).toBeCloseTo(
      MAX_DEPTH_SPEED,
      10,
    );
  });

  it("interpolates the floor->max halfway for a half pull", () => {
    expect(pullToDepthSpeed(MAX_PULL / 2, MAX_PULL)).toBeCloseTo(
      MIN_DEPTH_SPEED + (MAX_DEPTH_SPEED - MIN_DEPTH_SPEED) / 2,
      10,
    );
  });

  it("is strictly monotonic in pull strength (stronger pull => faster)", () => {
    let prev = pullToDepthSpeed(1, MAX_PULL);
    for (let i = 1; i <= 10; i++) {
      const cur = pullToDepthSpeed((MAX_PULL * i) / 10, MAX_PULL);
      expect(cur).toBeGreaterThan(prev);
      prev = cur;
    }
  });
});

describe("step (depth advance, no gravity)", () => {
  it("does not move a ball that was never launched (no gravity, no fall)", () => {
    const ball = createBall(240, 600);
    const startDepth = ball.depth;
    const startPos = { ...ball.pos };
    for (let i = 0; i < 500; i++) {
      step(ball, bounds, 1 / 60);
    }
    // A ball with no launch input stays put across repeated step() calls.
    expect(ball.depth).toBe(startDepth);
    expect(ball.depth).toBe(0);
    expect(ball.pos).toEqual(startPos);
  });

  it("advances depth from the front toward the back over time once launched", () => {
    const ball = createBall(240, 600);
    launchBall(ball, { x: 0, y: MAX_PULL }, MAX_PULL);
    expect(ball.depth).toBe(0);

    step(ball, bounds, 0.1);
    const afterOne = ball.depth;
    expect(afterOne).toBeGreaterThan(0);

    step(ball, bounds, 0.1);
    // Depth keeps increasing toward the back.
    expect(ball.depth).toBeGreaterThan(afterOne);
    expect(ball.depth).toBeLessThanOrEqual(DETECTOR_DEPTH);
  });

  it("ignores drag DIRECTION: only magnitude sets the advance", () => {
    const down = createBall(240, 600);
    const up = createBall(240, 600);
    const diag = createBall(240, 600);
    // Same magnitude (MAX_PULL), three different directions.
    launchBall(down, { x: 0, y: MAX_PULL }, MAX_PULL);
    launchBall(up, { x: 0, y: -MAX_PULL }, MAX_PULL);
    launchBall(diag, { x: MAX_PULL / Math.SQRT2, y: MAX_PULL / Math.SQRT2 }, MAX_PULL);
    expect(up.depthSpeed).toBeCloseTo(down.depthSpeed, 10);
    expect(diag.depthSpeed).toBeCloseTo(down.depthSpeed, 10);

    step(down, bounds, 0.1);
    step(up, bounds, 0.1);
    step(diag, bounds, 0.1);
    expect(up.depth).toBeCloseTo(down.depth, 10);
    expect(diag.depth).toBeCloseTo(down.depth, 10);
  });

  it("reaches the back strictly sooner for a stronger pull than a weaker one", () => {
    const strong = createBall(240, 600);
    const weak = createBall(240, 600);
    launchBall(strong, { x: 0, y: MAX_PULL }, MAX_PULL);
    launchBall(weak, { x: 0, y: MAX_PULL * 0.2 }, MAX_PULL);

    const dt = 1 / 120;
    function stepsToArrive(ball: ReturnType<typeof createBall>): number {
      for (let i = 1; i <= 10000; i++) {
        step(ball, bounds, dt);
        if (hasArrived(ball)) return i;
      }
      return Number.POSITIVE_INFINITY;
    }
    const strongSteps = stepsToArrive(strong);
    const weakSteps = stepsToArrive(weak);
    expect(Number.isFinite(strongSteps)).toBe(true);
    expect(Number.isFinite(weakSteps)).toBe(true);
    // Stronger pull arrives in strictly fewer steps.
    expect(strongSteps).toBeLessThan(weakSteps);
  });

  it("clamps depth at the detector plane and never overshoots", () => {
    const ball = createBall(240, 600);
    launchBall(ball, { x: 0, y: MAX_PULL }, MAX_PULL);
    for (let i = 0; i < 1000; i++) {
      step(ball, bounds, 0.1);
      expect(ball.depth).toBeLessThanOrEqual(DETECTOR_DEPTH);
    }
    expect(ball.depth).toBe(DETECTOR_DEPTH);
  });
});

describe("hasArrived (depth arrival predicate)", () => {
  it("is false for a fresh ball at the front", () => {
    const ball = createBall(240, 600);
    expect(hasArrived(ball)).toBe(false);
  });

  it("is false mid-flight and true exactly when depth reaches the plane", () => {
    const ball = createBall(240, 600);
    // Launch at a known speed: MIN..MAX; pick a mid pull for a few frames.
    launchBall(ball, { x: 0, y: MAX_PULL / 2 }, MAX_PULL);
    const dt = 1 / 60;
    let arrivedOnce = false;
    let depthWhenArrived = 0;
    for (let i = 0; i < 10000; i++) {
      const wasArrived = hasArrived(ball);
      step(ball, bounds, dt);
      if (!wasArrived && hasArrived(ball)) {
        arrivedOnce = true;
        depthWhenArrived = ball.depth;
        break;
      }
      // Before arrival the predicate must stay false.
      if (!hasArrived(ball)) {
        expect(ball.depth).toBeLessThan(DETECTOR_DEPTH);
      }
    }
    expect(arrivedOnce).toBe(true);
    expect(depthWhenArrived).toBeGreaterThanOrEqual(DETECTOR_DEPTH);
  });

  it("fires only once the ball has actually advanced to the back", () => {
    const ball = createBall(240, 600);
    launchBall(ball, { x: 0, y: MAX_PULL }, MAX_PULL);
    // One tiny step is not enough to arrive from the front.
    step(ball, bounds, 1 / 1000);
    expect(hasArrived(ball)).toBe(false);
  });
});
