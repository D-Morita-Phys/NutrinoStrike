import { describe, expect, it } from "vitest";
import {
  MAX_LAUNCH_SPEED,
  MAX_PULL,
  createBall,
  dragDistance,
  dragToVelocity,
  isAtRest,
  speed,
  step,
} from "../physics.ts";

describe("dragDistance", () => {
  it("is the Euclidean length of the drag vector", () => {
    expect(dragDistance({ x: 3, y: 4 })).toBe(5);
    expect(dragDistance({ x: 0, y: 0 })).toBe(0);
  });
});

describe("dragToVelocity", () => {
  it("launches opposite the drag direction (pull down -> fly up)", () => {
    // Drag straight down by the full pull distance.
    const v = dragToVelocity({ x: 0, y: MAX_PULL });
    expect(v.x).toBeCloseTo(0, 10);
    // Velocity points up (negative y) at full launch speed.
    expect(v.y).toBeCloseTo(-MAX_LAUNCH_SPEED, 6);
  });

  it("scales launch speed with drag distance up to maxPull", () => {
    const half = dragToVelocity({ x: 0, y: MAX_PULL / 2 });
    expect(Math.hypot(half.x, half.y)).toBeCloseTo(MAX_LAUNCH_SPEED / 2, 6);
  });

  it("caps launch speed at full strength for overdrawn pulls", () => {
    const over = dragToVelocity({ x: 0, y: MAX_PULL * 3 });
    expect(Math.hypot(over.x, over.y)).toBeCloseTo(MAX_LAUNCH_SPEED, 6);
  });

  it("returns a zero velocity for a zero-length drag", () => {
    const v = dragToVelocity({ x: 0, y: 0 });
    expect(v).toEqual({ x: 0, y: 0 });
  });

  it("preserves the launch direction for a diagonal drag", () => {
    // Drag down-right -> launch up-left.
    const v = dragToVelocity({ x: MAX_PULL, y: MAX_PULL });
    expect(v.x).toBeLessThan(0);
    expect(v.y).toBeLessThan(0);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(MAX_LAUNCH_SPEED, 6);
  });
});

describe("step", () => {
  const bounds = { width: 400, height: 600 };

  it("moves the ball and applies gravity over time", () => {
    const ball = createBall(200, 300);
    ball.vel = { x: 0, y: 0 };
    step(ball, bounds, 0.1);
    // Gravity pulls downward: y increases, downward velocity gained.
    expect(ball.pos.y).toBeGreaterThan(300);
    expect(ball.vel.y).toBeGreaterThan(0);
  });

  it("bounces off the floor and loses energy", () => {
    const ball = createBall(200, bounds.height - 1);
    ball.vel = { x: 0, y: 500 };
    step(ball, bounds, 0.05);
    // After clamping at the floor the velocity reverses (now upward).
    expect(ball.vel.y).toBeLessThan(0);
    expect(ball.pos.y).toBeLessThanOrEqual(bounds.height - ball.radius);
  });

  it("keeps the ball within the horizontal bounds", () => {
    const ball = createBall(5, 300);
    ball.vel = { x: -800, y: 0 };
    step(ball, bounds, 0.05);
    expect(ball.pos.x).toBeGreaterThanOrEqual(ball.radius);
  });
});

describe("isAtRest", () => {
  const bounds = { width: 400, height: 600 };

  /** Y coordinate that places the ball's bottom edge on the floor. */
  function floorY(): number {
    return bounds.height - createBall(0, 0).radius;
  }

  it("is true when the ball is slow and on the floor", () => {
    const ball = createBall(200, floorY());
    ball.vel = { x: 1, y: 1 };
    expect(isAtRest(ball, bounds)).toBe(true);
  });

  it("is false while the ball is moving fast", () => {
    const ball = createBall(200, floorY());
    ball.vel = { x: 0, y: 400 };
    expect(isAtRest(ball, bounds)).toBe(false);
  });

  it("is false while the ball is airborne", () => {
    const ball = createBall(200, 100);
    ball.vel = { x: 0, y: 0 };
    expect(isAtRest(ball, bounds)).toBe(false);
  });
});

describe("speed", () => {
  it("is the velocity magnitude", () => {
    const ball = createBall(0, 0);
    ball.vel = { x: 3, y: 4 };
    expect(speed(ball)).toBe(5);
  });
});
