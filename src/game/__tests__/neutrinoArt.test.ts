import { describe, expect, it } from "vitest";
import { neutrinoArtSvg } from "../../ui/neutrinoArt.ts";
import { NEUTRINO_SPECIES } from "../neutrinos.ts";

describe("neutrinoArtSvg", () => {
  it("returns a non-empty inline SVG for every species", () => {
    for (const species of NEUTRINO_SPECIES) {
      const svg = neutrinoArtSvg(species);
      expect(svg.length).toBeGreaterThan(0);
      expect(svg).toContain("<svg");
      expect(svg).toContain("</svg>");
    }
  });

  it("marks each illustration as an accessible image", () => {
    for (const species of NEUTRINO_SPECIES) {
      const svg = neutrinoArtSvg(species);
      expect(svg).toContain('role="img"');
      expect(svg).toContain("aria-label");
    }
  });

  it("uses no external image references (offline-safe)", () => {
    for (const species of NEUTRINO_SPECIES) {
      const svg = neutrinoArtSvg(species);
      // The only allowed http(s) token is the SVG XML namespace.
      expect(svg).not.toContain("<image");
      expect(svg).not.toContain("xlink:href");
      expect(svg).not.toContain("url(http");
    }
  });

  it("produces distinct art across species (not all identical)", () => {
    const svgs = NEUTRINO_SPECIES.map((s) => neutrinoArtSvg(s));
    const unique = new Set(svgs);
    expect(unique.size).toBe(NEUTRINO_SPECIES.length);
  });
});
