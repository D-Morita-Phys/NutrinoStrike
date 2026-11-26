// Pure lottery logic: drag strength -> energy -> energy band -> observed species.
//
// Everything here is a pure function. drawNeutrino takes an injectable rng so
// tests can be deterministic. No rendering, DOM, or physics dependencies.

import {
  ENERGY_BANDS,
  MAX_ENERGY_MEV,
  MIN_ENERGY_MEV,
  NEUTRINO_SPECIES,
  type EnergyBand,
  type NeutrinoSpecies,
} from "./neutrinos.ts";

/** Clamp a number to the inclusive [min, max] range. */
function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Map a normalized drag strength to an energy in MeV.
 *
 * The mapping is LOGARITHMIC in energy: equal increments of pull strength cover
 * equal RATIOS of energy. Because the energy range [1, 1000] MeV spans three
 * decades and the band boundaries (10 and 100 MeV) sit one decade apart, each
 * band occupies an equal, usable slice of the pull range:
 *
 *   strength 0.00 -> 1 MeV      (low band start)
 *   strength 0.33 -> 10 MeV     (low -> mid boundary)
 *   strength 0.67 -> 100 MeV    (mid -> high boundary)
 *   strength 1.00 -> 1000 MeV   (high band end)
 *
 * A linear map instead collapses the low and mid bands into under ~10% of the
 * pull range, making a low-energy (reactor/geo) shot effectively unreachable.
 * The endpoints still map exactly to MIN/MAX so callers that depend on the
 * boundary behavior are unaffected.
 *
 * @param pullDistance how far the ball was pulled back (any unit).
 * @param maxPull the pull distance that corresponds to maximum strength.
 * @returns energy in [MIN_ENERGY_MEV, MAX_ENERGY_MEV].
 */
export function pullToEnergy(pullDistance: number, maxPull: number): number {
  if (!(maxPull > 0)) {
    // Degenerate configuration: no usable pull range. Return the minimum.
    return MIN_ENERGY_MEV;
  }
  const strength = clamp(pullDistance / maxPull, 0, 1);
  // energy = MIN * (MAX / MIN)^strength. Clamp the endpoints exactly so that
  // strength 0 -> MIN and strength 1 -> MAX despite floating-point rounding.
  if (strength <= 0) return MIN_ENERGY_MEV;
  if (strength >= 1) return MAX_ENERGY_MEV;
  return MIN_ENERGY_MEV * Math.pow(MAX_ENERGY_MEV / MIN_ENERGY_MEV, strength);
}

/**
 * Return the energy band that contains the given energy.
 *
 * Bands are half-open [minMeV, maxMeV). Energies at or below zero fall into the
 * lowest band; energies above every band fall into the highest band so the
 * function is total.
 */
export function energyToBand(energyMeV: number): EnergyBand {
  for (const band of ENERGY_BANDS) {
    if (energyMeV >= band.minMeV && energyMeV < band.maxMeV) {
      return band;
    }
  }
  // Energy below the first band's lower bound -> lowest band;
  // otherwise it is above everything -> highest band.
  const first = ENERGY_BANDS[0];
  if (energyMeV < first.minMeV) {
    return first;
  }
  return ENERGY_BANDS[ENERGY_BANDS.length - 1];
}

/**
 * Weighted-random selection of a species from a band's weight table.
 *
 * @param energyMeV neutrino energy, used to pick the band.
 * @param rng returns a float in [0, 1). Defaults to Math.random. Injectable so
 *            tests can feed exact cumulative positions.
 */
export function drawNeutrino(
  energyMeV: number,
  rng: () => number = Math.random,
): NeutrinoSpecies {
  const band = energyToBand(energyMeV);

  let total = 0;
  for (const species of NEUTRINO_SPECIES) {
    total += band.weights[species];
  }

  // Degenerate table (all zero weights): fall back to the first species.
  if (total <= 0) {
    return NEUTRINO_SPECIES[0];
  }

  // rng is expected in [0, 1); clamp defensively so a value of exactly 1 (or a
  // tiny floating error above the cumulative total) still resolves.
  const target = clamp(rng(), 0, 1 - Number.EPSILON) * total;

  let cumulative = 0;
  for (const species of NEUTRINO_SPECIES) {
    cumulative += band.weights[species];
    if (target < cumulative) {
      return species;
    }
  }

  // Unreachable in practice (target < total), but keeps the function total.
  return NEUTRINO_SPECIES[NEUTRINO_SPECIES.length - 1];
}
