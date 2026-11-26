// Application shell: wires the pure scene machine to the DOM screens, the
// persistent hamburger menu, and the Game lifecycle.
//
// Exactly one screen is visible at a time (toggled via the `hidden` attribute).
// The Canvas is created once by createScreens and never recreated, so entering
// the play scene starts the Game's rAF loop and leaving it stops the loop; no
// duplicate loops can accumulate.

import { createSceneMachine, type SceneId } from "../game/scenes.ts";
import { type DetectorId } from "../game/detectors.ts";
import { Game, type GameUi } from "../render/game.ts";
import { createTopBar } from "./menu.ts";
import { createScreens } from "./screens.ts";

export function mountApp(root: HTMLElement): void {
  const machine = createSceneMachine();

  // Default target until the player picks one on the select screen.
  let selectedDetector: DetectorId = "superK";

  const screens = createScreens({
    onStart: () => machine.go("select"),
    onOpenCollection: () => machine.go("collection"),
    onSelectDetector: (id) => {
      selectedDetector = id;
      machine.go("play");
    },
  });

  const topBar = createTopBar({
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

  // Construct the Game once against the single, persistent canvas.
  const ui: GameUi = {
    result: screens.resultBox,
    history: screens.history,
    energyReadout: screens.energyReadout,
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
      game.setDetector(selectedDetector);
      startGame();
    } else {
      stopGame();
    }
  };

  machine.onChange((to) => showScene(to));
  showScene(machine.current());
}
