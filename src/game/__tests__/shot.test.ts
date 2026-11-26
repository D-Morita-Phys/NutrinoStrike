import { describe, expect, it } from "vitest";
import {
  createShotState,
  isFreshShot,
  launchShot,
  resetShotState,
  resolveShotState,
} from "../shot.ts";

describe("shot state lifecycle", () => {
  it("starts fresh: not launched, not resolved, zero energy", () => {
    const s = createShotState();
    expect(s.launched).toBe(false);
    expect(s.resolved).toBe(false);
    expect(s.shotEnergyMeV).toBe(0);
    expect(isFreshShot(s)).toBe(true);
  });

  it("launchShot locks in energy and flags launched (not fresh)", () => {
    const s = createShotState();
    launchShot(s, 42);
    expect(s.launched).toBe(true);
    expect(s.resolved).toBe(false);
    expect(s.shotEnergyMeV).toBe(42);
    expect(isFreshShot(s)).toBe(false);
  });

  it("resolveShotState marks a launched shot resolved", () => {
    const s = createShotState();
    launchShot(s, 42);
    resolveShotState(s);
    expect(s.launched).toBe(true);
    expect(s.resolved).toBe(true);
    expect(isFreshShot(s)).toBe(false);
  });

  // This is the regression guard for the replay (もういちど) glitch: a shot
  // that resolved against a detector must return to the fresh state on reset,
  // so re-entering the play scene never inherits launched/resolved=true.
  it("resetShotState clears a resolved shot back to fresh", () => {
    const s = createShotState();
    launchShot(s, 123.4);
    resolveShotState(s);
    // Precondition: a stale, resolved shot (the exact state the play scene used
    // to inherit on replay).
    expect(s.launched).toBe(true);
    expect(s.resolved).toBe(true);

    resetShotState(s);

    expect(s.launched).toBe(false);
    expect(s.resolved).toBe(false);
    expect(s.shotEnergyMeV).toBe(0);
    expect(isFreshShot(s)).toBe(true);
  });

  it("reset is idempotent and returns the same record", () => {
    const s = createShotState();
    launchShot(s, 50);
    resolveShotState(s);
    const once = resetShotState(s);
    const twice = resetShotState(s);
    expect(once).toBe(s);
    expect(twice).toBe(s);
    expect(isFreshShot(s)).toBe(true);
  });

  it("a reset shot is byte-for-byte a fresh shot", () => {
    const s = createShotState();
    launchShot(s, 999);
    resolveShotState(s);
    resetShotState(s);
    expect(s).toEqual(createShotState());
  });
});
