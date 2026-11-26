// Scene (screen) state machine for Neutrino Strike.
//
// This module is PURE and DOM-free so it can be unit-tested in isolation. It
// models which of the five screens is active and which transitions are legal.
// The UI layer (src/ui/) subscribes via onChange and toggles DOM visibility;
// it never decides transitions itself.

/** The five screens the app can show. */
export type SceneId = "start" | "select" | "play" | "result" | "collection";

/** All scenes, in a stable order (useful for building containers). */
export const SCENE_IDS: readonly SceneId[] = [
  "start",
  "select",
  "play",
  "result",
  "collection",
];

/**
 * Allowed transitions, keyed by the source scene. The lists below encode the
 * intended navigation flow:
 *   start  -> select (スタート) | collection (コレクション)
 *   select -> play (detector chosen) | start (back)
 *   play   -> result (a shot resolved) | start (restart)
 *   result -> play (もういちど / replay) | collection (コレクションを見る) | start
 *   collection -> start (back)
 *
 * Two rules sit on top of this table and apply from ANY scene:
 *   - You may always go to 'start' (the hamburger "やり直し" / restart action).
 *   - You may always go to 'collection' (reachable from the hamburger menu and
 *     the start screen on every screen).
 * Re-selecting the current scene is a no-op (handled in go()).
 */
const TRANSITIONS: Record<SceneId, readonly SceneId[]> = {
  start: ["select", "collection"],
  select: ["play", "start"],
  play: ["result", "start"],
  result: ["play", "collection", "start"],
  collection: ["start"],
};

/** Scenes reachable from anywhere via the persistent hamburger menu. */
const GLOBAL_TARGETS: readonly SceneId[] = ["start", "collection"];

/** A subscriber notified whenever the active scene changes. */
export type SceneListener = (to: SceneId, from: SceneId) => void;

/** The scene machine instance returned by {@link createSceneMachine}. */
export interface SceneMachine {
  /** The currently active scene. */
  current(): SceneId;
  /** True when a transition from the current scene to `to` is permitted. */
  canGo(to: SceneId): boolean;
  /**
   * Attempt a transition to `to`. Returns true if the scene changed. A
   * disallowed transition is a no-op that returns false. Re-selecting the
   * current scene is also a no-op (returns false) and fires no listeners.
   */
  go(to: SceneId): boolean;
  /**
   * Subscribe to scene changes. Returns an unsubscribe function. Listeners are
   * only called on an actual change (not for no-op transitions).
   */
  onChange(cb: SceneListener): () => void;
}

/** Create a fresh scene machine. The initial scene is always 'start'. */
export function createSceneMachine(initial: SceneId = "start"): SceneMachine {
  let current: SceneId = initial;
  const listeners = new Set<SceneListener>();

  const canGo = (to: SceneId): boolean => {
    if (to === current) return false;
    if (GLOBAL_TARGETS.includes(to)) return true;
    return TRANSITIONS[current].includes(to);
  };

  const go = (to: SceneId): boolean => {
    if (!canGo(to)) return false;
    const from = current;
    current = to;
    for (const cb of listeners) cb(to, from);
    return true;
  };

  const onChange = (cb: SceneListener): (() => void) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  };

  return {
    current: () => current,
    canGo,
    go,
    onChange,
  };
}
