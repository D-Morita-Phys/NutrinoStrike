// DOM renderers for the result card and the collection (zukan) grid.
//
// These take the pure data (NEUTRINO_INFO, the collection state, a resolved
// Observation) and build DOM into a container the screens own. Keeping them
// here keeps screens.ts focused on layout and lets app.ts re-render on demand.

import {
  NEUTRINO_INFO,
  NEUTRINO_SPECIES,
  type NeutrinoSpecies,
} from "../game/neutrinos.ts";
import {
  completionRate,
  discoveredCount,
  isDiscovered,
  TOTAL_SPECIES,
  type CollectionState,
} from "../game/collection.ts";
import { formatEnergy, type Observation } from "../render/game.ts";

/** Formatted completion percentage, e.g. "50%". */
function completionPercent(state: CollectionState): string {
  return `${Math.round(completionRate(state) * 100)}%`;
}

/**
 * Render the result card for a resolved observation. `isNew` adds a NEW! badge
 * the first time a species is discovered; a supernova burst gets the rare
 * celebration banner and styling.
 */
export function renderResultCard(
  container: HTMLElement,
  obs: Observation,
  isNew: boolean,
): void {
  const info = NEUTRINO_INFO[obs.species];
  const rare = obs.species === "supernovaBurst";
  container.innerHTML = "";
  container.classList.toggle("is-rare", rare);

  if (rare) {
    const banner = document.createElement("div");
    banner.className = "rare-banner";
    banner.textContent = "★ レア発見！ ★";
    container.append(banner);
  }

  const header = document.createElement("div");
  header.className = "result-card-header";

  const swatch = document.createElement("span");
  swatch.className = "result-swatch result-swatch-lg";
  swatch.style.background = info.color;

  const names = document.createElement("div");
  names.className = "result-card-names";
  const nameJa = document.createElement("div");
  nameJa.className = "result-card-name-ja";
  nameJa.textContent = info.nameJa;
  if (isNew) {
    const badge = document.createElement("span");
    badge.className = "new-badge";
    badge.textContent = "NEW!";
    nameJa.append(" ", badge);
  }
  const nameEn = document.createElement("div");
  nameEn.className = "result-card-name-en";
  nameEn.textContent = info.name;
  names.append(nameJa, nameEn);

  header.append(swatch, names);

  const meta = document.createElement("p");
  meta.className = "result-card-meta";
  meta.textContent =
    `観測した検出器: ${obs.detector.label}（${obs.detector.labelJa}）／ ` +
    `エネルギー: ${formatEnergy(obs.energyMeV)}`;

  const desc = document.createElement("p");
  desc.className = "result-card-desc";
  desc.textContent = info.descriptionJa;

  container.append(header, meta, desc);
}

/** Build one zukan card for a species (discovered or locked). */
function speciesCard(
  species: NeutrinoSpecies,
  discovered: boolean,
): HTMLElement {
  const info = NEUTRINO_INFO[species];
  const card = document.createElement("article");
  card.className = `zukan-card${discovered ? "" : " is-locked"}`;

  const swatch = document.createElement("span");
  swatch.className = "zukan-swatch";
  // Locked species show a neutral silhouette color, not the real hue.
  swatch.style.background = discovered ? info.color : "rgba(255,255,255,0.12)";

  const name = document.createElement("div");
  name.className = "zukan-name";
  name.textContent = discovered ? info.nameJa : "???";

  const desc = document.createElement("p");
  desc.className = "zukan-desc";
  desc.textContent = discovered
    ? info.descriptionJa
    : "まだ観測していません。検出器に撃ち込んで見つけよう。";

  card.append(swatch, name, desc);
  return card;
}

/** Render the full zukan: discovery stats + a card per species. */
export function renderCollection(
  container: HTMLElement,
  state: CollectionState,
): void {
  container.innerHTML = "";

  const stats = document.createElement("div");
  stats.className = "collection-stats";
  const count = document.createElement("span");
  count.className = "collection-count";
  count.textContent = `発見 ${discoveredCount(state)} / ${TOTAL_SPECIES}`;
  const rate = document.createElement("span");
  rate.className = "collection-rate";
  rate.textContent = `コンプリート率 ${completionPercent(state)}`;
  stats.append(count, rate);

  const bar = document.createElement("div");
  bar.className = "collection-bar";
  const fill = document.createElement("div");
  fill.className = "collection-bar-fill";
  fill.style.width = completionPercent(state);
  bar.append(fill);

  const grid = document.createElement("div");
  grid.className = "zukan-grid";
  for (const species of NEUTRINO_SPECIES) {
    grid.append(speciesCard(species, isDiscovered(state, species)));
  }

  container.append(stats, bar, grid);
}
