// Self-generated SVG art for the six neutrino species.
//
// No external image URLs: every illustration is produced as inline SVG markup
// in code, so the game stays fully offline on the /NutrinoStrike/ Pages subpath.
// The art is symbolic (not photoreal) and each species harmonizes with its
// theme color from NEUTRINO_INFO:
//   - reactor        : reactor vessel with fuel rods and a containment dome
//   - geo            : cross-sectioned Earth with a glowing inner core
//   - dsnb           : many faint, diffuse distant supernovae (scattered light)
//   - atmospheric    : a cosmic ray hitting the atmosphere and showering down
//   - accelerator    : an accelerator ring / beamline with a focused beam
//   - supernovaBurst : a bright exploding star with radiating burst rays (rare)
//
// Each function returns an SVG string sized to a 0 0 160 200 viewBox so the art
// lines up with detectorArt.ts. This module is PURE string building: it only
// reads NEUTRINO_INFO data and uses no DOM/window, so it imports cleanly in the
// node Vitest environment.

import { NEUTRINO_INFO, type NeutrinoSpecies } from "../game/neutrinos.ts";

/** Reactor: containment dome over a reactor vessel with glowing fuel rods. */
function reactorSvg(): string {
  const color = NEUTRINO_INFO.reactor.color;
  const rods: string[] = [];
  const rodCount = 5;
  const x0 = 62;
  const x1 = 98;
  for (let i = 0; i < rodCount; i++) {
    const x = x0 + ((x1 - x0) * i) / (rodCount - 1);
    rods.push(
      `<rect x="${(x - 2.2).toFixed(1)}" y="116" width="4.4" height="34" rx="2" ` +
        `fill="${color}" opacity="0.85"/>`,
    );
  }
  return `
<svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Reactor neutrino: reactor vessel and containment dome">
  <defs>
    <radialGradient id="nrReactorCore" cx="0.5" cy="0.6" r="0.6">
      <stop offset="0" stop-color="#eaffff"/>
      <stop offset="0.55" stop-color="${color}"/>
      <stop offset="1" stop-color="#15415a"/>
    </radialGradient>
  </defs>
  <!-- containment dome -->
  <path d="M34 108 A46 46 0 0 1 126 108 Z" fill="#132a44" stroke="${color}" stroke-width="3"/>
  <path d="M46 108 A34 34 0 0 1 114 108" fill="none" stroke="${color}" stroke-width="1.2" opacity="0.5"/>
  <!-- base slab -->
  <rect x="30" y="108" width="100" height="58" rx="5" fill="#0f2238" stroke="${color}" stroke-width="3"/>
  <!-- reactor vessel -->
  <rect x="56" y="98" width="48" height="60" rx="8" fill="url(#nrReactorCore)" stroke="#dff6ff" stroke-width="2"/>
  <!-- fuel rods -->
  ${rods.join("\n  ")}
  <!-- core glow -->
  <circle cx="80" cy="128" r="12" fill="#eaffff" opacity="0.5"/>
  <!-- cooling stack -->
  <rect x="96" y="60" width="16" height="50" rx="3" fill="#132a44" stroke="${color}" stroke-width="2"/>
</svg>`.trim();
}

/** Geo: cross-sectioned Earth with a glowing radioactive core. */
function geoSvg(): string {
  const color = NEUTRINO_INFO.geo.color;
  return `
<svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Geoneutrino: cross-sectioned Earth with glowing core">
  <defs>
    <radialGradient id="nrGeoCore" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#fff6d6"/>
      <stop offset="0.45" stop-color="#ffb74d"/>
      <stop offset="1" stop-color="#b5521a"/>
    </radialGradient>
    <linearGradient id="nrGeoMantle" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#a97f58"/>
      <stop offset="1" stop-color="#5c3d25"/>
    </linearGradient>
  </defs>
  <!-- crust / outer sphere -->
  <circle cx="80" cy="104" r="66" fill="#2f6b3a" stroke="${color}" stroke-width="3"/>
  <!-- mantle wedge cut-away -->
  <path d="M80 104 L146 104 A66 66 0 0 1 80 170 Z" fill="url(#nrGeoMantle)" stroke="${color}" stroke-width="1.5"/>
  <!-- mantle ring -->
  <circle cx="80" cy="104" r="44" fill="none" stroke="${color}" stroke-width="2" opacity="0.6"/>
  <!-- outer core -->
  <circle cx="80" cy="104" r="26" fill="#d9772b" opacity="0.85"/>
  <!-- inner glowing core -->
  <circle cx="80" cy="104" r="16" fill="url(#nrGeoCore)"/>
  <circle cx="80" cy="104" r="22" fill="none" stroke="#fff6d6" stroke-width="1.2" opacity="0.6"/>
</svg>`.trim();
}

/** DSNB: a dark sky dusted with many faint, diffuse distant supernovae. */
function dsnbSvg(): string {
  const color = NEUTRINO_INFO.dsnb.color;
  const points: string[] = [];
  // A deterministic pseudo-scatter of faint far-away supernovae.
  const count = 26;
  let seed = 1013;
  const rand = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < count; i++) {
    const x = 20 + rand() * 120;
    const y = 36 + rand() * 128;
    const r = 0.8 + rand() * 2.6;
    const op = (0.25 + rand() * 0.55).toFixed(2);
    points.push(
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" ` +
        `fill="${color}" opacity="${op}"/>`,
    );
  }
  // A few slightly brighter diffuse halos.
  const halos: string[] = [];
  for (let i = 0; i < 5; i++) {
    const x = 28 + rand() * 104;
    const y = 44 + rand() * 112;
    halos.push(
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" ` +
        `fill="${color}" opacity="0.12"/>`,
    );
  }
  return `
<svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Diffuse supernova background: many faint distant supernovae">
  <rect x="12" y="24" width="136" height="152" rx="10" fill="#140b22" stroke="${color}" stroke-width="2"/>
  ${halos.join("\n  ")}
  ${points.join("\n  ")}
</svg>`.trim();
}

/** Atmospheric: a cosmic ray striking the atmosphere and showering particles. */
function atmosphericSvg(): string {
  const color = NEUTRINO_INFO.atmospheric.color;
  const apexX = 80;
  const apexY = 70;
  const trails: string[] = [];
  const dots: string[] = [];
  const branches = 7;
  for (let i = 0; i < branches; i++) {
    const t = i / (branches - 1);
    const endX = 28 + t * 104;
    const endY = 170;
    trails.push(
      `<line x1="${apexX}" y1="${apexY}" x2="${endX.toFixed(1)}" y2="${endY}" ` +
        `stroke="${color}" stroke-width="1.6" opacity="0.7"/>`,
    );
    // Secondary particles along each shower track.
    for (let k = 1; k <= 3; k++) {
      const f = apexY + ((endY - apexY) * k) / 3.4;
      const px = apexX + (endX - apexX) * (k / 3.4);
      dots.push(
        `<circle cx="${px.toFixed(1)}" cy="${f.toFixed(1)}" r="2.4" fill="${color}" opacity="0.85"/>`,
      );
    }
  }
  return `
<svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Atmospheric neutrino: cosmic ray shower cascade">
  <!-- upper atmosphere band -->
  <path d="M12 70 Q80 44 148 70" fill="none" stroke="${color}" stroke-width="2" opacity="0.5"/>
  <path d="M12 86 Q80 60 148 86" fill="none" stroke="${color}" stroke-width="1.2" opacity="0.3"/>
  <!-- incoming cosmic ray -->
  <line x1="40" y1="16" x2="${apexX}" y2="${apexY}" stroke="#ffffff" stroke-width="2.4"/>
  <polygon points="36,12 48,18 40,24" fill="#ffffff"/>
  <!-- first interaction point -->
  <circle cx="${apexX}" cy="${apexY}" r="5" fill="#ffffff"/>
  <!-- shower cascade -->
  ${trails.join("\n  ")}
  ${dots.join("\n  ")}
</svg>`.trim();
}

/** Accelerator: a storage ring with a straight beamline and a focused beam. */
function acceleratorSvg(): string {
  const color = NEUTRINO_INFO.accelerator.color;
  const magnets: string[] = [];
  const count = 12;
  const cx = 80;
  const cy = 86;
  const rx = 52;
  const ry = 40;
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    magnets.push(
      `<rect x="${(x - 3).toFixed(1)}" y="${(y - 3).toFixed(1)}" width="6" height="6" rx="1.5" ` +
        `fill="#0b1026" stroke="${color}" stroke-width="1.4"/>`,
    );
  }
  // Focused beam fired out tangentially toward a target at the bottom.
  const beamDots: string[] = [];
  for (let i = 0; i < 6; i++) {
    const y = 130 + i * 10;
    beamDots.push(
      `<circle cx="${(cx + rx).toFixed(1)}" cy="${y}" r="${(3.4 - i * 0.3).toFixed(1)}" ` +
        `fill="${color}" opacity="${(0.9 - i * 0.1).toFixed(2)}"/>`,
    );
  }
  return `
<svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Accelerator neutrino: storage ring and focused beamline">
  <!-- storage ring -->
  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${color}" stroke-width="3"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${rx - 8}" ry="${ry - 7}" fill="none" stroke="${color}" stroke-width="1" opacity="0.4"/>
  <!-- bending magnets -->
  ${magnets.join("\n  ")}
  <!-- extraction beamline -->
  <line x1="${cx + rx}" y1="${cy}" x2="${cx + rx}" y2="176" stroke="${color}" stroke-width="2.4"/>
  <!-- focused beam -->
  ${beamDots.join("\n  ")}
  <!-- target -->
  <rect x="${cx + rx - 8}" y="176" width="16" height="8" rx="2" fill="#0b1026" stroke="${color}" stroke-width="1.6"/>
</svg>`.trim();
}

/** Supernova burst: a bright exploding star with radiating rays (rare drop). */
function supernovaBurstSvg(): string {
  const color = NEUTRINO_INFO.supernovaBurst.color;
  const cx = 80;
  const cy = 100;
  const rays: string[] = [];
  const rayCount = 16;
  for (let i = 0; i < rayCount; i++) {
    const a = (Math.PI * 2 * i) / rayCount;
    const long = i % 2 === 0;
    const r1 = 30;
    const r2 = long ? 80 : 60;
    const x1 = cx + Math.cos(a) * r1;
    const y1 = cy + Math.sin(a) * r1;
    const x2 = cx + Math.cos(a) * r2;
    const y2 = cy + Math.sin(a) * r2;
    rays.push(
      `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ` +
        `stroke="${color}" stroke-width="${long ? 3 : 1.8}" stroke-linecap="round" opacity="${long ? 0.9 : 0.6}"/>`,
    );
  }
  return `
<svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Supernova burst neutrino: exploding star with radiating rays (rare)">
  <defs>
    <radialGradient id="nrBurstCore" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.4" stop-color="#ffe0b2"/>
      <stop offset="0.75" stop-color="${color}"/>
      <stop offset="1" stop-color="#5a1414"/>
    </radialGradient>
  </defs>
  <!-- shockwave halos -->
  <circle cx="${cx}" cy="${cy}" r="74" fill="none" stroke="${color}" stroke-width="1" opacity="0.25"/>
  <circle cx="${cx}" cy="${cy}" r="56" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.4"/>
  <!-- burst rays -->
  ${rays.join("\n  ")}
  <!-- exploding core -->
  <circle cx="${cx}" cy="${cy}" r="30" fill="url(#nrBurstCore)"/>
  <circle cx="${cx}" cy="${cy}" r="14" fill="#ffffff" opacity="0.9"/>
</svg>`.trim();
}

/** Return the inline SVG markup for a neutrino species' illustration. */
export function neutrinoArtSvg(species: NeutrinoSpecies): string {
  switch (species) {
    case "reactor":
      return reactorSvg();
    case "geo":
      return geoSvg();
    case "dsnb":
      return dsnbSvg();
    case "atmospheric":
      return atmosphericSvg();
    case "accelerator":
      return acceleratorSvg();
    case "supernovaBurst":
      return supernovaBurstSvg();
  }
}
