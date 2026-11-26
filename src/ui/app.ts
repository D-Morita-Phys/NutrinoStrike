// Application shell: wires the pure scene machine to the DOM screens, the
// persistent hamburger menu, and the Game lifecycle.
//
// Exactly one screen is visible at a time (toggled via the `hidden` attribute).
// The Canvas is created once by createScreens and never recreated, so entering
// the play scene starts the Game's rAF loop and leaving it stops the loop; no
// duplicate loops can accumulate.

import { createSceneMachine, type SceneId } from "../game/scenes.ts";
import { type DetectorId } from "../game/detectors.ts";
import { Game, type GameUi, type Observation } from "../render/game.ts";
import {
  isDiscovered,
  load,
  markDiscovered,
  save,
  type CollectionState,
} from "../game/collection.ts";
import { renderCollection, renderResultCard } from "./content.ts";
import { createTopBar } from "./menu.ts";
import { createScreens } from "./screens.ts";

export function mountApp(root: HTMLElement): void {
  const machine = createSceneMachine();

  // Default target until the player picks one on the select screen.
  let selectedDetector: DetectorId = "superK";

  // Collection (zukan) state, persisted to localStorage via the pure store.
  const storage = window.localStorage;
  let collection: CollectionState = load(storage);

  const screens = createScreens({
    onStart: () => machine.go("select"),
    onOpenCollection: () => machine.go("collection"),
    onSelectDetector: (id) => {
      selectedDetector = id;
      machine.go("play");
    },
    onReplay: () => machine.go("play"),
    onBackToStart: () => machine.go("start"),
  });

  const topBar = createTopBar({
    // やり直し restarts the whole run from the start screen (deliberate: the
    // player re-picks a detector). Re-entering play always resets the ball and
    // shot state, so no stale play state carries over from the previous run.
    onRestart: () => machine.go("start"),
    onOpenCollection: () => machine.go("collection"),
    onVolumeChange: (value) => {
      void game.getAudio().resume();
      game.getAudio().setVolume(value);
    },
  });

  // Build the DOM: top bar + a stack of screen containers.
  const screenStack = document.createElement("div");
  screenStack.className = "screen-stack";
  const containers: Record<SceneId, HTMLElement> = {
    start: screens.start,
    select: screens.select,
    play: screens.play,
    result: screens.result,
    collection: screens.collection,
  };
  for (const id of ["start", "select", "play", "result", "collection"] as const) {
    screenStack.appendChild(containers[id]);
  }

  root.innerHTML = "";
  root.append(topBar.element, screenStack);

  // Handle a resolved shot: record the discovery (with first-time detection),
  // persist it, populate the result screen, and navigate there.
  const onResolve = (obs: Observation): void => {
    const firstTime = !isDiscovered(collection, obs.species);
    if (firstTime) {
      collection = markDiscovered(collection, obs.species);
      save(storage, collection);
    }
    renderResultCard(screens.resultBody, obs, firstTime);
    machine.go("result");
  };

  // Construct the Game once against the single, persistent canvas.
  const ui: GameUi = {
    result: screens.resultBox,
    history: screens.history,
    energyReadout: screens.energyReadout,
    onResolve,
  };
  const game = new Game(screens.canvas, ui);
  let gameRunning = false;

  // Reflect the persisted volume in the menu slider.
  topBar.setVolume(game.getAudio().getVolume());

  const startGame = (): void => {
    if (gameRunning) return;
    game.start();
    gameRunning = true;
  };
  const stopGame = (): void => {
    if (!gameRunning) return;
    game.stop();
    gameRunning = false;
  };

  const showScene = (scene: SceneId): void => {
    for (const id of Object.keys(containers) as SceneId[]) {
      containers[id].hidden = id !== scene;
    }
    topBar.close();
    if (scene === "play") {
      // Always start a replay clean: point at the chosen detector and reset the
      // ball/shot state so the previous run's resolved shot never leaks in.
      game.setDetector(selectedDetector);
      game.reset();
      startGame();
    } else {
      stopGame();
    }
    if (scene === "collection") {
      renderCollection(screens.collectionBody, collection);
    }
  };

  machine.onChange((to) => showScene(to));
  showScene(machine.current());
}
