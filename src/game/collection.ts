// Collection (zukan) store for Neutrino Strike.
//
// This module is PURE: it tracks which neutrino species the player has
// discovered and persists that set to a Storage-like object. The browser's
// localStorage is one such object, but any injected { getItem, setItem }
// works, so the whole store can be unit-tested without a DOM.
//
// The functions never touch global localStorage directly; the caller passes
// the storage in. app.ts injects window.localStorage at runtime.

import {
  NEUTRINO_SPECIES,
  isNeutrinoSpecies,
  type NeutrinoSpecies,
} from "./neutrinos.ts";

/** localStorage key for the discovered set, namespaced to the game. */
export const COLLECTION_STORAGE_KEY = "neutrino-strike:collection";

/**
 * The minimal Storage surface the store needs. `window.localStorage` satisfies
 * this; so does a tiny in-memory fake used by the tests.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** In-memory collection state: the set of discovered species. */
export interface CollectionState {
  readonly discovered: ReadonlySet<NeutrinoSpecies>;
}

/** Total number of species in the game (denominator for completion). */
export const TOTAL_SPECIES = NEUTRINO_SPECIES.length;

/** Create an empty collection (nothing discovered yet). */
export function createEmpty(): CollectionState {
  return { discovered: new Set<NeutrinoSpecies>() };
}

/**
 * Parse a raw stored string into a discovered set, tolerating malformed or
 * older data: a non-JSON string, wrong shape, or unknown ids all degrade to
 * "ignore the bad parts" rather than throwing. Only valid species survive.
 */
function parseDiscovered(raw: string | null): Set<NeutrinoSpecies> {
  const set = new Set<NeutrinoSpecies>();
  if (raw === null) return set;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return set;
  }
  // Accept both the current shape { discovered: string[] } and a bare array
  // (an older/simpler format), so upgrades never wipe a player's progress.
  const ids: unknown = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object"
      ? (parsed as { discovered?: unknown }).discovered
      : undefined;
  if (!Array.isArray(ids)) return set;
  for (const id of ids) {
    if (typeof id === "string" && isNeutrinoSpecies(id)) {
      set.add(id);
    }
  }
  return set;
}

/** Load the collection from storage, defaulting to empty when absent/invalid. */
export function load(storage: StorageLike): CollectionState {
  let raw: string | null = null;
  try {
    raw = storage.getItem(COLLECTION_STORAGE_KEY);
  } catch {
    raw = null;
  }
  return { discovered: parseDiscovered(raw) };
}

/** Serialize the collection state to the string stored under the key. */
export function serialize(state: CollectionState): string {
  // Store in the stable NEUTRINO_SPECIES order for deterministic output.
  const ordered = NEUTRINO_SPECIES.filter((s) => state.discovered.has(s));
  return JSON.stringify({ discovered: ordered });
}

/** Persist the collection state to storage (best effort; swallows failures). */
export function save(storage: StorageLike, state: CollectionState): void {
  try {
    storage.setItem(COLLECTION_STORAGE_KEY, serialize(state));
  } catch {
    // Storage may be unavailable (private mode); progress still holds for the
    // session.
  }
}

/** True when the species has been discovered. */
export function isDiscovered(
  state: CollectionState,
  species: NeutrinoSpecies,
): boolean {
  return state.discovered.has(species);
}

/**
 * Return a state with `species` marked discovered. Idempotent: re-discovering
 * an already-known species returns the input state unchanged (same reference),
 * which lets callers skip a needless save.
 */
export function markDiscovered(
  state: CollectionState,
  species: NeutrinoSpecies,
): CollectionState {
  if (state.discovered.has(species)) return state;
  const next = new Set(state.discovered);
  next.add(species);
  return { discovered: next };
}

/** How many species have been discovered. */
export function discoveredCount(state: CollectionState): number {
  return state.discovered.size;
}

/** Completion as a fraction in [0, 1] (discovered / total). */
export function completionRate(state: CollectionState): number {
  if (TOTAL_SPECIES === 0) return 0;
  return state.discovered.size / TOTAL_SPECIES;
}
