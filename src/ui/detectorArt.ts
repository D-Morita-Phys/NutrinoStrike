// Self-generated SVG art for the detector-select screen.
//
// No external image URLs: both illustrations are produced as inline SVG markup
// in code. They are symbolic (not photoreal):
//   - Super-Kamiokande: a cylindrical water tank with a grid of
//     photomultiplier-tube (PMT) dots lining the walls.
//   - KamLAND: a spherical liquid-scintillator balloon suspended in an outer
//     tank, with a sparse ring of surrounding PMTs.
//
// Each function returns an SVG string sized to a 0 0 160 200 viewBox so the two
// cards line up. Colors echo the detector theme colors in detectors.ts.

import type { DetectorId } from "../game/detectors.ts";

/** Super-Kamiokande: cylindrical tank with a grid of PMT dots. */
function superKamiokandeSvg(): string {
  const color = "#81c784";
  const wall = "#1b2a4a";
  const dots: string[] = [];
  // Grid of PMT dots on the front wall of the cylinder.
  const cols = 7;
  const rows = 6;
  const x0 = 40;
  const x1 = 120;
  const y0 = 56;
  const y1 = 150;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = x0 + ((x1 - x0) * c) / (cols - 1);
      const y = y0 + ((y1 - y0) * r) / (rows - 1);
      dots.push(
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.2" ` +
          `fill="#0b1026" stroke="${color}" stroke-width="1.2" ` +
          `fill-opacity="0.85"/>`,
      );
    }
  }
  return `
<svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Super-Kamiokande tank">
  <defs>
    <linearGradient id="skWater" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#15305a"/>
      <stop offset="1" stop-color="#0b1b33"/>
    </linearGradient>
  </defs>
  <!-- cylindrical tank body -->
  <rect x="34" y="40" width="92" height="120" rx="6" fill="url(#skWater)" stroke="${color}" stroke-width="3"/>
  <!-- top ellipse (open cylinder look) -->
  <ellipse cx="80" cy="40" rx="46" ry="14" fill="${wall}" stroke="${color}" stroke-width="3"/>
  <ellipse cx="80" cy="40" rx="46" ry="14" fill="none" stroke="${color}" stroke-width="1" opacity="0.5"/>
  <!-- bottom ellipse -->
  <ellipse cx="80" cy="160" rx="46" ry="14" fill="#0b1b33" stroke="${color}" stroke-width="3"/>
  <!-- water surface shimmer line -->
  <ellipse cx="80" cy="52" rx="40" ry="9" fill="none" stroke="${color}" stroke-width="1" opacity="0.4"/>
  <!-- PMT grid on the wall -->
  ${dots.join("\n  ")}
</svg>`.trim();
}

/** KamLAND: spherical scintillator balloon inside an outer tank. */
function kamlandSvg(): string {
  const color = "#4fc3f7";
  const pmts: string[] = [];
  // Ring of surrounding PMTs around the balloon.
  const count = 16;
  const cx = 80;
  const cy = 108;
  const rr = 62;
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr * 0.92;
    pmts.push(
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" ` +
        `fill="#0b1026" stroke="${color}" stroke-width="1.2"/>`,
    );
  }
  return `
<svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="KamLAND balloon detector">
  <defs>
    <radialGradient id="klBalloon" cx="0.4" cy="0.35" r="0.75">
      <stop offset="0" stop-color="#bbeaff"/>
      <stop offset="0.5" stop-color="#4fc3f7"/>
      <stop offset="1" stop-color="#1a6ea0"/>
    </radialGradient>
  </defs>
  <!-- outer stainless tank -->
  <circle cx="80" cy="108" r="74" fill="#0b1b33" stroke="${color}" stroke-width="2" opacity="0.6"/>
  <!-- surrounding PMTs -->
  ${pmts.join("\n  ")}
  <!-- scintillator balloon -->
  <circle cx="80" cy="108" r="46" fill="url(#klBalloon)" stroke="#dff6ff" stroke-width="2"/>
  <!-- suspension rope -->
  <line x1="80" y1="34" x2="80" y2="62" stroke="${color}" stroke-width="2"/>
  <!-- highlight -->
  <ellipse cx="66" cy="92" rx="14" ry="9" fill="#ffffff" opacity="0.35"/>
</svg>`.trim();
}

/** Return the inline SVG markup for a detector's illustration. */
export function detectorArtSvg(id: DetectorId): string {
  return id === "superK" ? superKamiokandeSvg() : kamlandSvg();
}
