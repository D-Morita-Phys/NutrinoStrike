// Entry point: build the page layout, construct the Game, and start the loop.
import "./style.css";
import { Game, type GameUi } from "./render/game.ts";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("#app mount point not found");
}

app.innerHTML = `
  <header class="masthead">
    <h1>Neutrino Strike</h1>
    <p class="tagline">
      ニュートリノの玉を検出器に打ち込んで、観測される種類をガチャで引こう。
    </p>
  </header>
  <main class="layout">
    <section class="stage">
      <canvas id="game-canvas" aria-label="Neutrino Strike play field"></canvas>
      <p id="energy-readout" class="energy-readout"></p>
    </section>
    <aside class="panel">
      <h2>Latest observation</h2>
      <div id="result" class="result">No observation yet.</div>
      <h2>History</h2>
      <ol id="history" class="history"></ol>
      <section class="howto">
        <h2>How to play</h2>
        <p>
          Press (or touch) the glowing ball, drag <strong>DOWN</strong>, and
          release. The ball launches <strong>UP</strong> with a speed set by how
          far you pulled. A stronger pull means higher neutrino energy, which
          changes which species you are likely to observe when the ball strikes
          Super-Kamiokande or KamLAND.
        </p>
      </section>
    </aside>
  </main>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
const result = document.querySelector<HTMLElement>("#result");
const history = document.querySelector<HTMLElement>("#history");
const energyReadout = document.querySelector<HTMLElement>("#energy-readout");

if (!canvas || !result || !history || !energyReadout) {
  throw new Error("Game UI elements failed to mount");
}

const ui: GameUi = { result, history, energyReadout };
const game = new Game(canvas, ui);
game.start();
