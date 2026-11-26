import { describe, expect, it } from "vitest";
import {
  drawNeutrino,
  energyToBand,
  pullToEnergy,
} from "../lottery.ts";
import {
  ENERGY_BANDS,
  MAX_ENERGY_MEV,
  MIN_ENERGY_MEV,
  NEUTRINO_SPECIES,
  isNeutrinoSpecies,
  type NeutrinoSpecies,
} from "../neutrinos.ts";

describe("pullToEnergy", () => {
  it("maps zero strength to the minimum energy", () => {
    expect(pullToEnergy(0, 100)).toBe(MIN_ENERGY_MEV);
  });

  it("maps full strength to the maximum energy", () => {
    expect(pullToEnergy(100, 100)).toBe(MAX_ENERGY_MEV);
  });

  it("maps the midpoint linearly", () => {
    const expected = MIN_ENERGY_MEV + 0.5 * (MAX_ENERGY_MEV - MIN_ENERGY_MEV);
    expect(pullToEnergy(50, 100)).toBeCloseTo(expected, 10);
  });

  it("clamps overdrawn pulls to the maximum", () => {
    expect(pullToEnergy(500, 100)).toBe(MAX_ENERGY_MEV);
  });

  it("clamps negative pulls to the minimum", () => {
    expect(pullToEnergy(-20, 100)).toBe(MIN_ENERGY_MEV);
  });

  it("returns the minimum when maxPull is not usable", () => {
    expect(pullToEnergy(10, 0)).toBe(MIN_ENERGY_MEV);
    expect(pullToEnergy(10, -5)).toBe(MIN_ENERGY_MEV);
  });
});

describe("energyToBand", () => {
  it("returns the low band inside its range", () => {
    expect(energyToBand(5).id).toBe("low");
  });

  it("includes the lower boundary of a band (half-open)", () => {
    expect(energyToBand(0).id).toBe("low");
    expect(energyToBand(10).id).toBe("mid");
    expect(energyToBand(100).id).toBe("high");
  });

  it("excludes the upper boundary of a band (half-open)", () => {
    // 9.999 is still low, 99.999 is still mid.
    expect(energyToBand(9.999).id).toBe("low");
    expect(energyToBand(99.999).id).toBe("mid");
  });

  it("returns the mid band within its range", () => {
    expect(energyToBand(50).id).toBe("mid");
  });

  it("returns the high band for very large energies", () => {
    expect(energyToBand(100).id).toBe("high");
    expect(energyToBand(5000).id).toBe("high");
  });

  it("clamps sub-zero energy into the lowest band", () => {
    expect(energyToBand(-10).id).toBe("low");
  });
});

describe("drawNeutrino", () => {
  // Weight tables per band order: reactor, geo, dsnb, atmospheric, accelerator,
  // supernovaBurst. Helper to find the cumulative slice of a species in a band.
  function sliceCenter(bandId: string, species: NeutrinoSpecies): number {
    const band = ENERGY_BANDS.find((b) => b.id === bandId);
    if (!band) throw new Error(`no band ${bandId}`);
    const total = NEUTRINO_SPECIES.reduce((s, sp) => s + band.weights[sp], 0);
    let cumulative = 0;
    for (const sp of NEUTRINO_SPECIES) {
      const w = band.weights[sp];
      if (sp === species) {
        // Return an rng value whose target lands in the middle of this slice.
        return (cumulative + w / 2) / total;
      }
      cumulative += w;
    }
    throw new Error(`species ${species} not found`);
  }

  it("returns the first species when rng is 0", () => {
    // target = 0 falls in the first (reactor) slice of the low band.
    expect(drawNeutrino(5, () => 0)).toBe("reactor");
  });

  it("selects reactor for an rng value inside reactor's low-band slice", () => {
    expect(drawNeutrino(5, () => sliceCenter("low", "reactor"))).toBe("reactor");
  });

  it("selects geo for an rng value inside geo's low-band slice", () => {
    expect(drawNeutrino(5, () => sliceCenter("low", "geo"))).toBe("geo");
  });

  it("selects dsnb as the dominant mid-band species", () => {
    expect(drawNeutrino(50, () => sliceCenter("mid", "dsnb"))).toBe("dsnb");
  });

  it("selects atmospheric and accelerator in the high band", () => {
    expect(drawNeutrino(500, () => sliceCenter("high", "atmospheric"))).toBe(
      "atmospheric",
    );
    expect(drawNeutrino(500, () => sliceCenter("high", "accelerator"))).toBe(
      "accelerator",
    );
  });

  it("can reach supernovaBurst in the low-energy band", () => {
    // Feed an rng value that lands in the supernovaBurst slice of the low band.
    const rng = sliceCenter("low", "supernovaBurst");
    expect(drawNeutrino(5, () => rng)).toBe("supernovaBurst");
  });

  it("only ever returns the 6 valid species across the whole rng range", () => {
    const samples = 2000;
    for (const energy of [5, 50, 500]) {
      for (let i = 0; i < samples; i++) {
        const value = i / samples; // spans [0, 1)
        const result = drawNeutrino(energy, () => value);
        expect(isNeutrinoSpecies(result)).toBe(true);
      }
    }
  });

  it("handles an rng that returns exactly 1 without throwing", () => {
    const result = drawNeutrino(5, () => 1);
    expect(isNeutrinoSpecies(result)).toBe(true);
  });
});

describe("balance table invariants", () => {
  it("has a nonzero supernovaBurst weight in every band", () => {
    for (const band of ENERGY_BANDS) {
      expect(band.weights.supernovaBurst).toBeGreaterThan(0);
    }
  });

  it("keeps the physical dominant-species ordering per band", () => {
    const low = ENERGY_BANDS.find((b) => b.id === "low")!;
    const mid = ENERGY_BANDS.find((b) => b.id === "mid")!;
    const high = ENERGY_BANDS.find((b) => b.id === "high")!;

    // Low band dominated by reactor + geo.
    for (const other of ["dsnb", "atmospheric", "accelerator", "supernovaBurst"] as const) {
      expect(low.weights.reactor).toBeGreaterThan(low.weights[other]);
      expect(low.weights.geo).toBeGreaterThan(low.weights[other]);
    }

    // Mid band dominated by dsnb.
    for (const other of ["reactor", "geo", "atmospheric", "accelerator", "supernovaBurst"] as const) {
      expect(mid.weights.dsnb).toBeGreaterThan(mid.weights[other]);
    }

    // High band dominated by atmospheric + accelerator.
    for (const other of ["reactor", "geo", "dsnb", "supernovaBurst"] as const) {
      expect(high.weights.atmospheric).toBeGreaterThan(high.weights[other]);
      expect(high.weights.accelerator).toBeGreaterThan(high.weights[other]);
    }
  });
});
