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

  it("maps the midpoint logarithmically (geometric mean of the range)", () => {
    // A log map sends the midpoint to the geometric mean of MIN and MAX, not
    // the arithmetic mean.
    const geoMean = Math.sqrt(MIN_ENERGY_MEV * MAX_ENERGY_MEV);
    expect(pullToEnergy(50, 100)).toBeCloseTo(geoMean, 6);
  });

  it("is monotonically increasing in pull strength", () => {
    let prev = pullToEnergy(0, 100);
    for (let d = 1; d <= 100; d++) {
      const e = pullToEnergy(d, 100);
      expect(e).toBeGreaterThan(prev);
      prev = e;
    }
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

describe("pull strength selects the energy band", () => {
  // Each of the three bands must be reachable from a realistic pull. With a log
  // map the low/mid/high bands each occupy a third of the pull range, so a
  // gentle, medium and strong pull land in low, mid and high respectively.
  const maxPull = 220;

  it("lands a gentle pull in the low band (reactor/geo regime)", () => {
    // A short pull, well above the launch threshold but well below mid.
    for (const frac of [0.05, 0.15, 0.25]) {
      const energy = pullToEnergy(frac * maxPull, maxPull);
      expect(energyToBand(energy).id).toBe("low");
    }
  });

  it("lands a medium pull in the mid band (dsnb regime)", () => {
    for (const frac of [0.4, 0.5, 0.6]) {
      const energy = pullToEnergy(frac * maxPull, maxPull);
      expect(energyToBand(energy).id).toBe("mid");
    }
  });

  it("lands a strong pull in the high band (atmospheric/accelerator regime)", () => {
    for (const frac of [0.75, 0.9, 1.0]) {
      const energy = pullToEnergy(frac * maxPull, maxPull);
      expect(energyToBand(energy).id).toBe("high");
    }
  });

  it("keeps the minimum launch threshold inside the low band", () => {
    // render/game.ts refuses to launch for a pull under 4 px; that shortest
    // real shot must still be a low-band (reactor/geo) observation.
    expect(energyToBand(pullToEnergy(4, maxPull)).id).toBe("low");
  });

  it("gives each band a comparable share of the pull range", () => {
    // Sample the whole usable pull range and count how many samples fall in
    // each band. No band should be starved (each must get a real slice).
    const counts = { low: 0, mid: 0, high: 0 };
    const samples = 1000;
    for (let i = 0; i <= samples; i++) {
      const energy = pullToEnergy((i / samples) * maxPull, maxPull);
      counts[energyToBand(energy).id]++;
    }
    // With an even three-decade log split each band should get roughly a third;
    // assert a generous lower bound so all three are comfortably reachable.
    expect(counts.low).toBeGreaterThan(samples * 0.2);
    expect(counts.mid).toBeGreaterThan(samples * 0.2);
    expect(counts.high).toBeGreaterThan(samples * 0.2);
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
