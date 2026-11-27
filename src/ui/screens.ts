// Screen containers for the five scenes.
//
// Each scene has a dedicated container element. Exactly one is shown at a time
// (see app.ts). The Canvas lives in the play screen and is created ONCE, never
// recreated when switching scenes, so the Game's rAF loop can simply be
// stopped/started.
//
// FEAT-001 scope: start screen is fully built; select / result / collection are
// lightweight stubs that FEAT-002 and FEAT-003 flesh out. The play screen hosts
// the existing gameplay DOM (canvas, energy readout, result/history/how-to
// panels) so the current drag-launch loop keeps working after the refactor.

import { DETECTOR_IDS, type DetectorId } from "../game/detectors.ts";
import { detectorArtSvg } from "./detectorArt.ts";

export interface StartScreenHandlers {
  onStart(): void;
  onOpenCollection(): void;
  /**
   * Proceed from the select screen to play with the chosen detector. The id
   * becomes the single on-field target for the shot.
   */
  onSelectDetector(id: DetectorId): void;
  /** もういちど: replay the play scene with the same selected detector. */
  onReplay(): void;
  /** Back from a screen to the start screen. */
  onBackToStart(): void;
}

export interface Screens {
  /** Scene container elements keyed for the app to toggle visibility. */
  readonly start: HTMLElement;
  readonly select: HTMLElement;
  readonly play: HTMLElement;
  readonly result: HTMLElement;
  readonly collection: HTMLElement;
  /** Gameplay DOM references the Game needs. */
  readonly canvas: HTMLCanvasElement;
  readonly energyReadout: HTMLElement;
  readonly resultBox: HTMLElement;
  readonly history: HTMLElement;
  /** Container the app fills with the resolved observation's details. */
  readonly resultBody: HTMLElement;
  /** Container the app fills with the zukan grid + stats. */
  readonly collectionBody: HTMLElement;
}

function screen(id: string, extraClass = ""): HTMLElement {
  const el = document.createElement("section");
  el.className = `screen${extraClass ? ` ${extraClass}` : ""}`;
  el.id = `screen-${id}`;
  el.hidden = true;
  return el;
}

/** Build all screen containers and return references for wiring. */
export function createScreens(handlers: StartScreenHandlers): Screens {
  // --- Start screen ---
  const start = screen("start", "screen-start");
  const startTitle = document.createElement("h1");
  startTitle.className = "start-title";
  startTitle.textContent = "Neutrino Strike";
  const startTagline = document.createElement("p");
  startTagline.className = "start-tagline";
  startTagline.textContent =
    "ニュートリノの玉を検出器に打ち込んで、観測される種類をガチャで引こう。";

  const startBtn = document.createElement("button");
  startBtn.type = "button";
  startBtn.className = "btn btn-primary btn-lg";
  startBtn.textContent = "スタート";
  startBtn.addEventListener("click", handlers.onStart);

  const collectionBtn = document.createElement("button");
  collectionBtn.type = "button";
  collectionBtn.className = "btn btn-secondary btn-lg";
  collectionBtn.textContent = "コレクション";
  collectionBtn.addEventListener("click", handlers.onOpenCollection);

  const startActions = document.createElement("div");
  startActions.className = "start-actions";
  startActions.append(startBtn, collectionBtn);
  start.append(startTitle, startTagline, startActions);

  // --- Select screen: choose KamLAND or Super-Kamiokande ---
  const select = screen("select", "screen-select");
  const selectHeading = document.createElement("h2");
  selectHeading.className = "screen-heading";
  selectHeading.textContent = "検出器をえらぶ";
  const selectNote = document.createElement("p");
  selectNote.className = "screen-note";
  selectNote.textContent =
    "ニュートリノを撃ち込む的を選びましょう。選んだ検出器が的になります。";

  const detectorGrid = document.createElement("div");
  detectorGrid.className = "detector-grid";

  const DETECTOR_BLURB: Record<DetectorId, { name: string; ja: string; blurb: string }> = {
    kamland: {
      name: "KamLAND",
      ja: "カムランド",
      blurb: "液体シンチレーターの球形バルーン。低エネルギー観測が得意。",
    },
    superK: {
      name: "Super-Kamiokande",
      ja: "スーパーカミオカンデ",
      blurb: "巨大な水チェレンコフ検出器。壁一面の光電子増倍管が目印。",
    },
  };

  for (const id of DETECTOR_IDS) {
    const info = DETECTOR_BLURB[id];
    const card = document.createElement("button");
    card.type = "button";
    card.className = "detector-card";
    card.dataset.detector = id;
    card.setAttribute("aria-label", `${info.name} をえらぶ`);

    const art = document.createElement("div");
    art.className = "detector-art";
    art.innerHTML = detectorArtSvg(id);

    const name = document.createElement("div");
    name.className = "detector-name";
    name.textContent = info.name;

    const ja = document.createElement("div");
    ja.className = "detector-name-ja";
    ja.textContent = info.ja;

    const blurb = document.createElement("p");
    blurb.className = "detector-blurb";
    blurb.textContent = info.blurb;

    card.append(art, name, ja, blurb);
    card.addEventListener("click", () => handlers.onSelectDetector(id));
    detectorGrid.append(card);
  }

  select.append(selectHeading, selectNote, detectorGrid);

  // --- Play screen (hosts the live gameplay) ---
  const play = screen("play", "screen-play");
  const layout = document.createElement("main");
  layout.className = "layout";

  const stage = document.createElement("section");
  stage.className = "stage";
  const canvas = document.createElement("canvas");
  canvas.id = "game-canvas";
  canvas.setAttribute("aria-label", "Neutrino Strike play field");
  const energyReadout = document.createElement("p");
  energyReadout.id = "energy-readout";
  energyReadout.className = "energy-readout";
  stage.append(canvas, energyReadout);

  const panel = document.createElement("aside");
  panel.className = "panel";
  const resultHeading = document.createElement("h2");
  resultHeading.textContent = "Latest observation";
  const resultBox = document.createElement("div");
  resultBox.id = "result";
  resultBox.className = "result";
  resultBox.textContent = "No observation yet.";
  const historyHeading = document.createElement("h2");
  historyHeading.textContent = "History";
  const history = document.createElement("ol");
  history.id = "history";
  history.className = "history";
  const howto = document.createElement("section");
  howto.className = "howto";
  const howtoHeading = document.createElement("h2");
  howtoHeading.textContent = "How to play";
  const howtoText = document.createElement("p");
  howtoText.innerHTML =
    "Press (or touch) the glowing ball, drag <strong>DOWN</strong>, and " +
    "release. The ball launches <strong>UP</strong> with a speed set by how " +
    "far you pulled. A stronger pull means higher neutrino energy, which " +
    "changes which species you are likely to observe when the ball strikes " +
    "Super-Kamiokande or KamLAND.";
  howto.append(howtoHeading, howtoText);
  panel.append(resultHeading, resultBox, historyHeading, history, howto);

  layout.append(stage, panel);
  play.appendChild(layout);

  // --- Result screen: observed species + description + navigation ---
  const result = screen("result", "screen-result");
  const resultScreenHeading = document.createElement("h2");
  resultScreenHeading.className = "screen-heading";
  resultScreenHeading.textContent = "観測けっか";

  // The app fills this card with the resolved observation each time.
  const resultBody = document.createElement("div");
  resultBody.className = "result-card";

  const replayBtn = document.createElement("button");
  replayBtn.type = "button";
  replayBtn.className = "btn btn-primary btn-lg";
  replayBtn.textContent = "もういちど";
  replayBtn.addEventListener("click", handlers.onReplay);

  const seeCollectionBtn = document.createElement("button");
  seeCollectionBtn.type = "button";
  seeCollectionBtn.className = "btn btn-secondary btn-lg";
  seeCollectionBtn.textContent = "コレクションを見る";
  seeCollectionBtn.addEventListener("click", handlers.onOpenCollection);

  const resultActions = document.createElement("div");
  resultActions.className = "result-actions";
  resultActions.append(replayBtn, seeCollectionBtn);

  result.append(resultScreenHeading, resultBody, resultActions);

  // --- Collection screen: the zukan (app renders the grid + stats) ---
  const collection = screen("collection", "screen-collection");
  const collectionHeading = document.createElement("h2");
  collectionHeading.className = "screen-heading";
  collectionHeading.textContent = "コレクション / 図鑑";

  // The app fills this with the species grid and the discovery stats.
  const collectionBody = document.createElement("div");
  collectionBody.className = "collection-body";

  const collectionBackBtn = document.createElement("button");
  collectionBackBtn.type = "button";
  collectionBackBtn.className = "btn btn-secondary btn-lg";
  collectionBackBtn.textContent = "スタートにもどる";
  collectionBackBtn.addEventListener("click", handlers.onBackToStart);

  const collectionActions = document.createElement("div");
  collectionActions.className = "collection-actions";
  collectionActions.append(collectionBackBtn);

  collection.append(collectionHeading, collectionBody, collectionActions);

  return {
    start,
    select,
    play,
    result,
    collection,
    canvas,
    energyReadout,
    resultBox,
    history,
    resultBody,
    collectionBody,
  };
}
