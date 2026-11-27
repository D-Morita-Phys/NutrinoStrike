import { describe, expect, it, vi } from "vitest";
import {
  SCENE_IDS,
  createSceneMachine,
  type SceneId,
} from "../scenes.ts";

describe("scene machine", () => {
  it("starts on the 'start' scene by default", () => {
    const m = createSceneMachine();
    expect(m.current()).toBe("start");
  });

  it("honors an explicit initial scene", () => {
    const m = createSceneMachine("collection");
    expect(m.current()).toBe("collection");
  });

  it("exposes all five scene ids", () => {
    expect([...SCENE_IDS].sort()).toEqual(
      ["collection", "play", "result", "select", "start"].sort(),
    );
  });

  it("allows start -> select and updates current()", () => {
    const m = createSceneMachine();
    expect(m.canGo("select")).toBe(true);
    expect(m.go("select")).toBe(true);
    expect(m.current()).toBe("select");
  });

  it("walks the full happy-path flow select -> play -> result", () => {
    const m = createSceneMachine();
    m.go("select");
    expect(m.go("play")).toBe(true);
    expect(m.current()).toBe("play");
    expect(m.go("result")).toBe(true);
    expect(m.current()).toBe("result");
  });

  it("allows result -> play (replay) and result -> collection", () => {
    const replay = createSceneMachine();
    replay.go("select");
    replay.go("play");
    replay.go("result");
    expect(replay.canGo("play")).toBe(true);
    expect(replay.go("play")).toBe(true);
    expect(replay.current()).toBe("play");

    const toCollection = createSceneMachine();
    toCollection.go("select");
    toCollection.go("play");
    toCollection.go("result");
    expect(toCollection.go("collection")).toBe(true);
    expect(toCollection.current()).toBe("collection");
  });

  it("can always go to 'start' (restart) from any scene", () => {
    for (const scene of SCENE_IDS) {
      if (scene === "start") continue;
      const m = createSceneMachine(scene as SceneId);
      expect(m.canGo("start")).toBe(true);
      expect(m.go("start")).toBe(true);
      expect(m.current()).toBe("start");
    }
  });

  it("can always go to 'collection' from any scene", () => {
    for (const scene of SCENE_IDS) {
      if (scene === "collection") continue;
      const m = createSceneMachine(scene as SceneId);
      expect(m.canGo("collection")).toBe(true);
      expect(m.go("collection")).toBe(true);
      expect(m.current()).toBe("collection");
    }
  });

  it("rejects a disallowed transition as a no-op", () => {
    const m = createSceneMachine();
    // start -> play is not legal (must go through select).
    expect(m.canGo("play")).toBe(false);
    expect(m.go("play")).toBe(false);
    expect(m.current()).toBe("start");

    // start -> result is not legal either.
    expect(m.canGo("result")).toBe(false);
    expect(m.go("result")).toBe(false);
    expect(m.current()).toBe("start");
  });

  it("treats re-selecting the current scene as a no-op", () => {
    const m = createSceneMachine();
    const cb = vi.fn();
    m.onChange(cb);
    expect(m.canGo("start")).toBe(false);
    expect(m.go("start")).toBe(false);
    expect(cb).not.toHaveBeenCalled();
  });

  it("fires onChange subscribers with (to, from) on a real change", () => {
    const m = createSceneMachine();
    const cb = vi.fn();
    m.onChange(cb);
    m.go("select");
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("select", "start");
  });

  it("does not fire subscribers on a rejected transition", () => {
    const m = createSceneMachine();
    const cb = vi.fn();
    m.onChange(cb);
    m.go("play"); // rejected from start
    expect(cb).not.toHaveBeenCalled();
  });

  it("stops notifying after unsubscribe", () => {
    const m = createSceneMachine();
    const cb = vi.fn();
    const off = m.onChange(cb);
    m.go("select");
    off();
    m.go("play");
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
