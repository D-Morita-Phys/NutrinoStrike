import { describe, expect, it } from "vitest";
import {
  COLLECTION_STORAGE_KEY,
  TOTAL_SPECIES,
  completionRate,
  createEmpty,
  discoveredCount,
  isDiscovered,
  load,
  markDiscovered,
  save,
  type StorageLike,
} from "../collection.ts";
import {
  NEUTRINO_INFO,
  NEUTRINO_SPECIES,
} from "../neutrinos.ts";

/** A tiny in-memory Storage used to exercise the pure store without a DOM. */
function fakeStorage(initial: Record<string, string> = {}): StorageLike & {
  dump(): Record<string, string>;
} {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
    dump: () => Object.fromEntries(map),
  };
}

describe("collection: load defaults", () => {
  it("loads an empty collection when storage is empty", () => {
    const state = load(fakeStorage());
    expect(discoveredCount(state)).toBe(0);
    expect(completionRate(state)).toBe(0);
    for (const s of NEUTRINO_SPECIES) {
      expect(isDiscovered(state, s)).toBe(false);
    }
  });

  it("createEmpty yields nothing discovered", () => {
    expect(discoveredCount(createEmpty())).toBe(0);
  });
});

describe("collection: markDiscovered + save + reload round-trip", () => {
  it("persists discoveries and reloads them from the same storage", () => {
    const storage = fakeStorage();
    let state = load(storage);
    state = markDiscovered(state, "reactor");
    state = markDiscovered(state, "supernovaBurst");
    save(storage, state);

    const reloaded = load(storage);
    expect(isDiscovered(reloaded, "reactor")).toBe(true);
    expect(isDiscovered(reloaded, "supernovaBurst")).toBe(true);
    expect(isDiscovered(reloaded, "geo")).toBe(false);
    expect(discoveredCount(reloaded)).toBe(2);
  });

  it("writes under the namespaced key", () => {
    const storage = fakeStorage();
    save(storage, markDiscovered(createEmpty(), "geo"));
    expect(storage.dump()[COLLECTION_STORAGE_KEY]).toContain("geo");
  });
});

describe("collection: idempotent re-discovery", () => {
  it("re-discovering a known species returns the same reference", () => {
    const state = markDiscovered(createEmpty(), "dsnb");
    const again = markDiscovered(state, "dsnb");
    expect(again).toBe(state);
    expect(discoveredCount(again)).toBe(1);
  });

  it("does not grow the count on repeat discoveries", () => {
    let state = createEmpty();
    for (let i = 0; i < 5; i++) state = markDiscovered(state, "atmospheric");
    expect(discoveredCount(state)).toBe(1);
  });

  it("does not mutate the input state", () => {
    const state = createEmpty();
    markDiscovered(state, "accelerator");
    expect(discoveredCount(state)).toBe(0);
  });
});

describe("collection: count and completion math", () => {
  it("TOTAL_SPECIES matches the species list", () => {
    expect(TOTAL_SPECIES).toBe(NEUTRINO_SPECIES.length);
  });

  it("completionRate is discovered / total", () => {
    let state = createEmpty();
    state = markDiscovered(state, "reactor");
    state = markDiscovered(state, "geo");
    state = markDiscovered(state, "dsnb");
    expect(discoveredCount(state)).toBe(3);
    expect(completionRate(state)).toBeCloseTo(3 / TOTAL_SPECIES, 10);
  });

  it("reaches 1.0 when all species are discovered", () => {
    let state = createEmpty();
    for (const s of NEUTRINO_SPECIES) state = markDiscovered(state, s);
    expect(discoveredCount(state)).toBe(TOTAL_SPECIES);
    expect(completionRate(state)).toBe(1);
  });
});

describe("collection: tolerance of malformed / old stored JSON", () => {
  it("ignores non-JSON garbage and loads empty", () => {
    const state = load(fakeStorage({ [COLLECTION_STORAGE_KEY]: "not json {{{" }));
    expect(discoveredCount(state)).toBe(0);
  });

  it("ignores unknown species ids but keeps valid ones", () => {
    const raw = JSON.stringify({ discovered: ["reactor", "nope", 42, "geo"] });
    const state = load(fakeStorage({ [COLLECTION_STORAGE_KEY]: raw }));
    expect(isDiscovered(state, "reactor")).toBe(true);
    expect(isDiscovered(state, "geo")).toBe(true);
    expect(discoveredCount(state)).toBe(2);
  });

  it("accepts a bare array (older format)", () => {
    const raw = JSON.stringify(["dsnb", "supernovaBurst"]);
    const state = load(fakeStorage({ [COLLECTION_STORAGE_KEY]: raw }));
    expect(isDiscovered(state, "dsnb")).toBe(true);
    expect(isDiscovered(state, "supernovaBurst")).toBe(true);
    expect(discoveredCount(state)).toBe(2);
  });

  it("ignores a wrong-shaped object", () => {
    const raw = JSON.stringify({ foo: "bar" });
    const state = load(fakeStorage({ [COLLECTION_STORAGE_KEY]: raw }));
    expect(discoveredCount(state)).toBe(0);
  });

  it("survives a storage getItem that throws", () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error("boom");
      },
      setItem: () => {},
    };
    expect(discoveredCount(load(throwing))).toBe(0);
  });
});

describe("neutrino descriptions", () => {
  it("every species has a non-empty Japanese description", () => {
    for (const species of NEUTRINO_SPECIES) {
      const info = NEUTRINO_INFO[species];
      expect(info.descriptionJa, species).toBeDefined();
      expect(info.descriptionJa.trim().length).toBeGreaterThan(0);
    }
  });

  it("every species has a non-empty Japanese name", () => {
    for (const species of NEUTRINO_SPECIES) {
      expect(NEUTRINO_INFO[species].nameJa.trim().length).toBeGreaterThan(0);
    }
  });
});
