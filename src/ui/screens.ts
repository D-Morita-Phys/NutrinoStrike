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

export interface StartScreenHandlers {
  onStart(): void;
  onOpenCollection(): void;
  /**
   * Proceed from the select screen to play. In FEAT-001 the select screen is a
   * stub, so it exposes a single "play" button; FEAT-002 replaces this with the
   * KamLAND vs Super-Kamiokande detector choice.
   */
  onSelectDetector(): void;
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

  // --- Select screen (stub; FEAT-002 adds detector art + choice) ---
  const select = screen("select", "screen-select");
  const selectHeading = document.createElement("h2");
  selectHeading.className = "screen-heading";
  selectHeading.textContent = "検出器をえらぶ";
  const selectNote = document.createElement("p");
  selectNote.className = "screen-note";
  selectNote.textContent = "KamLAND か Super-Kamiokande を選択してください。";
  const selectPlayBtn = document.createElement("button");
  selectPlayBtn.type = "button";
  selectPlayBtn.className = "btn btn-primary btn-lg";
  selectPlayBtn.textContent = "プレイ";
  selectPlayBtn.addEventListener("click", handlers.onSelectDetector);
  select.append(selectHeading, selectNote, selectPlayBtn);

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

  // --- Result screen (stub; FEAT-003 adds descriptions + buttons) ---
  const result = screen("result", "screen-result");
  const resultScreenHeading = document.createElement("h2");
  resultScreenHeading.className = "screen-heading";
  resultScreenHeading.textContent = "けっか";
  result.append(resultScreenHeading);

  // --- Collection screen (stub; FEAT-003 adds the zukan) ---
  const collection = screen("collection", "screen-collection");
  const collectionHeading = document.createElement("h2");
  collectionHeading.className = "screen-heading";
  collectionHeading.textContent = "コレクション";
  const collectionNote = document.createElement("p");
  collectionNote.className = "screen-note";
  collectionNote.textContent = "見つけたニュートリノがここに並びます。";
  collection.append(collectionHeading, collectionNote);

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
  };
}
