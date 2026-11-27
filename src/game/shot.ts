// Pure, DOM-free shot state for a single launch.
//
// The Game (src/render/game.ts) owns the canvas, the rAF loop and input, but
// the per-shot lifecycle flags live here as a plain data record so the
// reset invariant can be unit-tested without a DOM or a Canvas.
//
// A shot moves through: fresh (home, not launched, not resolved) -> launched
// (energy locked in, in flight) -> resolved (hit a detector). Re-homing for a
// new shot is a RESET back to the fresh state. The replay (もういちど) bug was
// that re-entering the play scene never performed this reset, so a resolved
// shot leaked into the next run; keeping the reset here, pure and tested,
// guards that invariant.

/** The lifecycle flags + locked-in energy for one launch. */
export interface ShotState {
  /** True once the ball has been launched and is in flight. */
  launched: boolean;
  /** True once the shot has resolved into an observation (hit a detector). */
  resolved: boolean;
  /** Energy (MeV) locked in at launch for this shot's lottery draw. */
  shotEnergyMeV: number;
}

/**
 * A fresh shot state: ball at home, nothing launched, nothing resolved and no
 * energy locked in. This is the invariant a play-scene entry must satisfy so a
 * replay starts clean.
 */
export function createShotState(): ShotState {
  return { launched: false, resolved: false, shotEnergyMeV: 0 };
}

/**
 * Reset a shot state back to fresh IN PLACE and return it. Mutates so the Game
 * can share a single record, but the resulting values are exactly those of
 * {@link createShotState}.
 */
export function resetShotState(state: ShotState): ShotState {
  state.launched = false;
  state.resolved = false;
  state.shotEnergyMeV = 0;
  return state;
}

/** Record the launch of a shot: flag it launched and lock in its energy. */
export function launchShot(state: ShotState, energyMeV: number): ShotState {
  state.launched = true;
  state.resolved = false;
  state.shotEnergyMeV = energyMeV;
  return state;
}

/** Mark a launched shot resolved (it reached a detector). */
export function resolveShotState(state: ShotState): ShotState {
  state.resolved = true;
  return state;
}

/** True when the shot is in its fresh/reset state (safe to begin a new drag). */
export function isFreshShot(state: ShotState): boolean {
  return !state.launched && !state.resolved && state.shotEnergyMeV === 0;
}
