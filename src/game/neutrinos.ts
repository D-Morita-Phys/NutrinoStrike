// Pure data module for the neutrino gacha.
//
// This file holds the game's design data only: the six neutrino species, their
// display info, the pull-strength energy range, and the per-energy-band weight
// tables that drive the lottery. It has no dependency on rendering, the DOM, or
// physics so it can be unit tested in isolation and imported anywhere.

/**
 * The six neutrino species that can be observed.
 *
 * - reactor        : reactor neutrinos (nuclear power plants), low energy
 * - geo            : geoneutrinos from radioactive decay inside the Earth, low energy
 * - dsnb           : diffuse supernova neutrino background, mid energy
 * - atmospheric    : neutrinos from cosmic-ray air showers, high energy
 * - accelerator    : neutrinos produced at particle accelerators, high energy
 * - supernovaBurst : burst from a nearby core-collapse supernova, RARE drop
 */
export type NeutrinoSpecies =
  | "reactor"
  | "geo"
  | "dsnb"
  | "atmospheric"
  | "accelerator"
  | "supernovaBurst";

/** All species in a stable order. Handy for iteration and validation. */
export const NEUTRINO_SPECIES: readonly NeutrinoSpecies[] = [
  "reactor",
  "geo",
  "dsnb",
  "atmospheric",
  "accelerator",
  "supernovaBurst",
] as const;

/** Display metadata for a species. Pure data, used later by rendering. */
export interface NeutrinoInfo {
  /** Machine id, matches the NeutrinoSpecies key. */
  readonly id: NeutrinoSpecies;
  /** English display name. */
  readonly name: string;
  /** Japanese display label. */
  readonly nameJa: string;
  /** Short one-line description. */
  readonly description: string;
  /** CSS color used when this species is drawn or shown in the UI. */
  readonly color: string;
}

export const NEUTRINO_INFO: Readonly<Record<NeutrinoSpecies, NeutrinoInfo>> = {
  reactor: {
    id: "reactor",
    name: "Reactor neutrino",
    nameJa: "原子炉ニュートリノ",
    description: "Electron antineutrinos from nuclear reactor fission. A few MeV.",
    color: "#4fc3f7",
  },
  geo: {
    id: "geo",
    name: "Geoneutrino",
    nameJa: "地球ニュートリノ",
    description: "Antineutrinos from radioactive decay inside the Earth. A few MeV.",
    color: "#8d6e63",
  },
  dsnb: {
    id: "dsnb",
    name: "Supernova diffuse background neutrino",
    nameJa: "超新星背景ニュートリノ",
    description: "Faint background from all past supernovae. Tens of MeV.",
    color: "#ba68c8",
  },
  atmospheric: {
    id: "atmospheric",
    name: "Atmospheric neutrino",
    nameJa: "大気ニュートリノ",
    description: "Produced by cosmic-ray showers in the atmosphere. Hundreds of MeV and up.",
    color: "#81c784",
  },
  accelerator: {
    id: "accelerator",
    name: "Accelerator neutrino",
    nameJa: "加速器ニュートリノ",
    description: "Beams made at particle accelerators. Hundreds of MeV to GeV.",
    color: "#ffb74d",
  },
  supernovaBurst: {
    id: "supernovaBurst",
    name: "Supernova burst neutrino",
    nameJa: "超新星爆発ニュートリノ",
    description: "Intense burst from a nearby core-collapse supernova. Very rare.",
    color: "#e57373",
  },
};

// Pull-strength to energy mapping range.
//
// A fully released drag (normalized strength 1.0) maps to MAX_ENERGY_MEV and a
// minimal drag (0.0) maps to MIN_ENERGY_MEV. The range deliberately spans the
// low band (reactor/geo), the mid band (DSNB) and the high band
// (atmospheric/accelerator) so that pull strength selects the physics regime.
export const MIN_ENERGY_MEV = 1;
export const MAX_ENERGY_MEV = 1000;

/**
 * An energy band: a contiguous MeV range with a weight table that decides which
 * species is most likely to be observed when a neutrino lands in that band.
 */
export interface EnergyBand {
  /** Machine id for the band. */
  readonly id: "low" | "mid" | "high";
  /** English label. */
  readonly label: string;
  /** Japanese label. */
  readonly labelJa: string;
  /** Inclusive lower bound in MeV. */
  readonly minMeV: number;
  /** Exclusive upper bound in MeV (Infinity for the top band). */
  readonly maxMeV: number;
  /** Relative selection weights per species. Must be nonnegative. */
  readonly weights: Readonly<Record<NeutrinoSpecies, number>>;
}

// ---------------------------------------------------------------------------
// BALANCE KNOBS
//
// The weight tables below are the single place to tune gameplay balance. They
// are intentionally NON-PHYSICAL in absolute magnitude: the numbers are chosen
// for a fun drop distribution, not to reproduce real event rates. What they
// MUST respect is the band ordering of the dominant species:
//
//   low  (~0-10 MeV)    dominated by reactor + geo
//   mid  (~10-100 MeV)  dominated by dsnb
//   high (>=100 MeV)    dominated by atmospheric + accelerator
//
// supernovaBurst is the RARE drop: it carries a small but NONZERO weight in
// EVERY band so that a lucky hit can occur regardless of pull strength.
// Adjust these numbers to retune balance without touching the lottery logic
// or any rendering code.
// ---------------------------------------------------------------------------

export const ENERGY_BANDS: readonly EnergyBand[] = [
  {
    id: "low",
    label: "Low energy (~0-10 MeV)",
    labelJa: "低エネルギー帯 (~0-10 MeV)",
    minMeV: 0,
    maxMeV: 10,
    weights: {
      reactor: 50,
      geo: 40,
      dsnb: 6,
      atmospheric: 2,
      accelerator: 1,
      supernovaBurst: 1,
    },
  },
  {
    id: "mid",
    label: "Mid energy (~10-100 MeV)",
    labelJa: "中エネルギー帯 (~10-100 MeV)",
    minMeV: 10,
    maxMeV: 100,
    weights: {
      reactor: 8,
      geo: 4,
      dsnb: 70,
      atmospheric: 12,
      accelerator: 5,
      supernovaBurst: 1,
    },
  },
  {
    id: "high",
    label: "High energy (>=100 MeV)",
    labelJa: "高エネルギー帯 (>=100 MeV)",
    minMeV: 100,
    maxMeV: Infinity,
    weights: {
      reactor: 1,
      geo: 1,
      dsnb: 7,
      atmospheric: 45,
      accelerator: 45,
      supernovaBurst: 1,
    },
  },
];

/** Narrow a string to a NeutrinoSpecies if it is one. */
export function isNeutrinoSpecies(value: string): value is NeutrinoSpecies {
  return (NEUTRINO_SPECIES as readonly string[]).includes(value);
}
