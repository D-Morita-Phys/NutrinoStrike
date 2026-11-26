// Canvas rendering, input handling and the game loop for Neutrino Strike.
//
// The Game class owns a <canvas>, the Ball, the detectors, the current drag
// state and the requestAnimationFrame loop. It wires pointer input (mouse AND
// touch) to the physics launch, steps physics each frame, hit-tests the ball
// against the detectors, and on a hit runs the FEAT-001 lottery to decide the
// observed species. Results are pushed to a small on-page panel.

import {
  NEUTRINO_INFO,
  type NeutrinoSpecies,
} from "../game/neutrinos.ts";
import { drawNeutrino, energyToBand, pullToEnergy } from "../game/lottery.ts";
import {
  MAX_PULL,
  type Ball,
  type Bounds,
  type Vec2,
  createBall,
  dragDistance,
  dragToVelocity,
  isAtRest,
  step,
} from "../game/physics.ts";
import {
  type Detector,
  createDetectors,
  detectorHit,
} from "../game/detectors.ts";

// ---------------------------------------------------------------------------
// TUNABLE CONSTANTS (layout / presentation)
// ---------------------------------------------------------------------------

/** Canvas width in CSS pixels. */
export const CANVAS_WIDTH = 480;

/** Canvas height in CSS pixels. */
export const CANVAS_HEIGHT = 720;

/** Fraction of the canvas height where the ball rests before a shot. */
const BALL_HOME_Y_FRACTION = 0.82;

/** Max shots kept in the on-page history list. */
const MAX_HISTORY = 8;

/** A single observation result. */
export interface Observation {
  species: NeutrinoSpecies;
  detector: Detector;
  energyMeV: number;
}

/** Format an energy in MeV, switching to GeV at/above 1000 MeV. */
export function formatEnergy(energyMeV: number): string {
  if (energyMeV >= 1000) {
    return `${(energyMeV / 1000).toFixed(2)} GeV`;
  }
  return `${energyMeV.toFixed(1)} MeV`;
}

/** Elements the Game renders its textual output into. */
export interface GameUi {
  readonly result: HTMLElement;
  readonly history: HTMLElement;
  readonly energyReadout: HTMLElement;
}

export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly bounds: Bounds;
  private readonly detectors: Detector[];
  private ball: Ball;

  // Drag state.
  private dragging = false;
  private pointer: Vec2 = { x: 0, y: 0 };

  // Shot state.
  private launched = false;
  /** Energy (MeV) locked in at launch for this shot's lottery draw. */
  private shotEnergyMeV = 0;
  private resolved = false;

  private readonly history: Observation[] = [];
  private lastTime = 0;
  private rafId = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly ui: GameUi,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("2D canvas context is not available");
    }
    this.ctx = ctx;

    // Size the canvas backing store for crisp rendering on HiDPI displays.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    canvas.style.width = `${CANVAS_WIDTH}px`;
    canvas.style.height = `${CANVAS_HEIGHT}px`;
    this.ctx.scale(dpr, dpr);

    this.bounds = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
    this.detectors = createDetectors(CANVAS_WIDTH, CANVAS_HEIGHT);
    this.ball = this.makeHomeBall();

    this.attachInput();
    this.updateEnergyReadout(0);
  }

  /** Begin the render/update loop. */
  start(): void {
    this.lastTime = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - this.lastTime) / 1000, 1 / 30);
      this.lastTime = now;
      this.update(dt);
      this.render();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  /** Stop the loop and detach listeners. Useful for teardown/tests. */
  stop(): void {
    cancelAnimationFrame(this.rafId);
  }

  // --- Setup helpers -------------------------------------------------------

  private makeHomeBall(): Ball {
    return createBall(
      this.bounds.width / 2,
      this.bounds.height * BALL_HOME_Y_FRACTION,
    );
  }

  private resetBall(): void {
    this.ball = this.makeHomeBall();
    this.launched = false;
    this.resolved = false;
    this.shotEnergyMeV = 0;
    this.updateEnergyReadout(0);
  }

  // --- Input ---------------------------------------------------------------

  private attachInput(): void {
    this.canvas.addEventListener("mousedown", this.onDown);
    window.addEventListener("mousemove", this.onMove);
    window.addEventListener("mouseup", this.onUp);

    this.canvas.addEventListener("touchstart", this.onTouchStart, {
      passive: false,
    });
    this.canvas.addEventListener("touchmove", this.onTouchMove, {
      passive: false,
    });
    this.canvas.addEventListener("touchend", this.onTouchEnd, {
      passive: false,
    });
  }

  /** Map a client (page) coordinate to canvas space. */
  private toCanvas(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  private onDown = (e: MouseEvent): void => {
    this.beginDrag(this.toCanvas(e.clientX, e.clientY));
  };

  private onMove = (e: MouseEvent): void => {
    if (!this.dragging) return;
    this.moveDrag(this.toCanvas(e.clientX, e.clientY));
  };

  private onUp = (): void => {
    this.endDrag();
  };

  private onTouchStart = (e: TouchEvent): void => {
    if (e.touches.length === 0) return;
    e.preventDefault();
    const t = e.touches[0];
    this.beginDrag(this.toCanvas(t.clientX, t.clientY));
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (!this.dragging || e.touches.length === 0) return;
    e.preventDefault();
    const t = e.touches[0];
    this.moveDrag(this.toCanvas(t.clientX, t.clientY));
  };

  private onTouchEnd = (e: TouchEvent): void => {
    if (!this.dragging) return;
    e.preventDefault();
    this.endDrag();
  };

  /** The drag vector points from the ball toward the current pointer. */
  private currentDrag(): Vec2 {
    return { x: this.pointer.x - this.ball.pos.x, y: this.pointer.y - this.ball.pos.y };
  }

  private beginDrag(p: Vec2): void {
    // Only start a drag while the ball sits at home (no shot in flight).
    if (this.launched) return;
    const near = Math.hypot(p.x - this.ball.pos.x, p.y - this.ball.pos.y);
    // Generous grab radius so the control feels forgiving.
    if (near > this.ball.radius * 4) return;
    this.dragging = true;
    this.pointer = p;
    this.updateEnergyFromDrag();
  }

  private moveDrag(p: Vec2): void {
    this.pointer = p;
    this.updateEnergyFromDrag();
  }

  private endDrag(): void {
    if (!this.dragging) return;
    this.dragging = false;
    const drag = this.currentDrag();
    const dist = dragDistance(drag);
    if (dist < 4) {
      // A tap, not a pull: do not launch.
      this.updateEnergyReadout(0);
      return;
    }
    // Lock in the energy for this shot from the pull strength, then launch.
    this.shotEnergyMeV = pullToEnergy(dist, MAX_PULL);
    this.ball.vel = dragToVelocity(drag, MAX_PULL);
    this.launched = true;
    this.resolved = false;
  }

  private updateEnergyFromDrag(): void {
    const dist = dragDistance(this.currentDrag());
    this.updateEnergyReadout(pullToEnergy(dist, MAX_PULL));
  }

  private updateEnergyReadout(energyMeV: number): void {
    const band = energyToBand(energyMeV);
    this.ui.energyReadout.textContent =
      energyMeV > 0
        ? `Pull energy: ${formatEnergy(energyMeV)} (${band.label})`
        : "Pull the ball DOWN and release to launch it UP.";
  }

  // --- Update --------------------------------------------------------------

  private update(dt: number): void {
    if (!this.launched) return;

    step(this.ball, this.bounds, dt);

    if (!this.resolved) {
      const hit = detectorHit(this.detectors, this.ball);
      if (hit) {
        this.resolveShot(hit);
        return;
      }
    }

    // End a shot that never reached a detector.
    if (isAtRest(this.ball, this.bounds)) {
      this.resetBall();
    }
  }

  private resolveShot(detector: Detector): void {
    this.resolved = true;
    const species = drawNeutrino(this.shotEnergyMeV);
    const observation: Observation = {
      species,
      detector,
      energyMeV: this.shotEnergyMeV,
    };
    this.showResult(observation);
    this.history.unshift(observation);
    if (this.history.length > MAX_HISTORY) this.history.pop();
    this.renderHistory();

    // Give the ball a brief visible bounce, then reset for the next shot.
    window.setTimeout(() => this.resetBall(), 450);
  }

  // --- Result UI -----------------------------------------------------------

  private showResult(obs: Observation): void {
    const info = NEUTRINO_INFO[obs.species];
    this.ui.result.innerHTML = "";

    const swatch = document.createElement("span");
    swatch.className = "result-swatch";
    swatch.style.background = info.color;

    const title = document.createElement("div");
    title.className = "result-title";
    title.append(swatch, document.createTextNode(`${info.nameJa} / ${info.name}`));

    const detail = document.createElement("div");
    detail.className = "result-detail";
    detail.textContent =
      `Observed at ${obs.detector.label} (${obs.detector.labelJa}) ` +
      `at ${formatEnergy(obs.energyMeV)}.`;

    const desc = document.createElement("div");
    desc.className = "result-desc";
    desc.textContent = info.description;

    this.ui.result.append(title, detail, desc);
  }

  private renderHistory(): void {
    this.ui.history.innerHTML = "";
    for (const obs of this.history) {
      const info = NEUTRINO_INFO[obs.species];
      const li = document.createElement("li");

      const swatch = document.createElement("span");
      swatch.className = "result-swatch";
      swatch.style.background = info.color;

      const text = document.createElement("span");
      text.textContent =
        `${info.nameJa} @ ${obs.detector.label} (${formatEnergy(obs.energyMeV)})`;

      li.append(swatch, text);
      this.ui.history.append(li);
    }
  }

  // --- Render --------------------------------------------------------------

  private render(): void {
    const { ctx, bounds } = this;
    ctx.clearRect(0, 0, bounds.width, bounds.height);

    // Background gradient.
    const bg = ctx.createLinearGradient(0, 0, 0, bounds.height);
    bg.addColorStop(0, "#0b1026");
    bg.addColorStop(1, "#131a3a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, bounds.width, bounds.height);

    this.renderDetectors();
    this.renderAimGuide();
    this.renderBall();
  }

  private renderDetectors(): void {
    const { ctx } = this;
    for (const d of this.detectors) {
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = d.color;
      ctx.stroke();

      // Inner ring for a target look.
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius * 0.55, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.fillText(d.label, d.x, d.y - 4);
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillText(d.labelJa, d.x, d.y + 14);
    }
  }

  private renderAimGuide(): void {
    if (!this.dragging) return;
    const { ctx } = this;
    const drag = this.currentDrag();
    const dist = Math.min(dragDistance(drag), MAX_PULL);
    const energyMeV = pullToEnergy(dragDistance(drag), MAX_PULL);
    const band = energyToBand(energyMeV);

    // Pull-back line from ball to pointer.
    ctx.beginPath();
    ctx.moveTo(this.ball.pos.x, this.ball.pos.y);
    ctx.lineTo(this.pointer.x, this.pointer.y);
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    // Launch-direction arrow (opposite of the drag), colored by energy band.
    const len = dragDistance(drag);
    if (len > 0) {
      const ux = -drag.x / len;
      const uy = -drag.y / len;
      const guideLen = (dist / MAX_PULL) * 160;
      const ex = this.ball.pos.x + ux * guideLen;
      const ey = this.ball.pos.y + uy * guideLen;
      ctx.beginPath();
      ctx.moveTo(this.ball.pos.x, this.ball.pos.y);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = this.bandColor(band.id);
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    // Power/energy label near the ball.
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText(
      formatEnergy(energyMeV),
      this.ball.pos.x,
      this.ball.pos.y - this.ball.radius - 8,
    );
  }

  private bandColor(id: "low" | "mid" | "high"): string {
    switch (id) {
      case "low":
        return "#4fc3f7";
      case "mid":
        return "#ba68c8";
      case "high":
        return "#ffb74d";
    }
  }

  private renderBall(): void {
    const { ctx, ball } = this;

    // Glow that hints the ball's energy while dragging.
    const energyMeV = this.dragging
      ? pullToEnergy(dragDistance(this.currentDrag()), MAX_PULL)
      : this.shotEnergyMeV;
    const glow = energyMeV > 0 ? this.bandColor(energyToBand(energyMeV).id) : "#9fb3ff";

    const grad = ctx.createRadialGradient(
      ball.pos.x,
      ball.pos.y,
      2,
      ball.pos.x,
      ball.pos.y,
      ball.radius,
    );
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(1, glow);
    ctx.beginPath();
    ctx.arc(ball.pos.x, ball.pos.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.stroke();

    // At-rest ring hint when the ball is ready to shoot.
    if (!this.launched && !this.dragging) {
      ctx.beginPath();
      ctx.arc(ball.pos.x, ball.pos.y, ball.radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(159,179,255,0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}
