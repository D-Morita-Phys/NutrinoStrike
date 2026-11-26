// Canvas rendering, input handling and the game loop for Neutrino Strike.
//
// The Game class owns a <canvas>, the Ball, the single chosen detector, the
// current drag state and the requestAnimationFrame loop. It wires pointer input
// (mouse AND touch) to the physics launch, steps physics each frame, hit-tests
// the ball against the chosen detector, and on a hit runs the FEAT-001 lottery
// to decide the observed species. Results are pushed to a small on-page panel.
// A synthesized sound engine and a decaying screen shake add launch/hit feel.

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
  type DetectorId,
  createDetector,
  hitTest,
} from "../game/detectors.ts";
import { AudioEngine } from "../game/audio.ts";
import {
  type ShotState,
  createShotState,
  isFreshShot,
  launchShot,
  resetShotState,
  resolveShotState,
} from "../game/shot.ts";

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
  /**
   * Called when a shot resolves into an observation, so the app can switch to
   * the dedicated result scene and record the discovery. Optional so the Game
   * still works without an app wrapper (e.g. in isolated tests).
   */
  readonly onResolve?: (obs: Observation) => void;
}

/** The species treated as the rare drop with a special celebration effect. */
const RARE_SPECIES: NeutrinoSpecies = "supernovaBurst";

/** How fast the screen shake decays toward zero (higher = snappier). */
const SHAKE_DECAY_PER_SEC = 6;

export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly bounds: Bounds;
  private detector: Detector;
  private ball: Ball;

  // Drag state.
  private dragging = false;
  private pointer: Vec2 = { x: 0, y: 0 };
  /** Fixed home position the drag vector is always measured from. */
  private readonly home: Vec2;

  // Per-shot lifecycle (launched / resolved / locked-in energy). Kept as a
  // pure, reusable record so the reset invariant lives in a testable module.
  private shot: ShotState = createShotState();

  // Screen-shake state (magnitude in pixels, decays to zero over time).
  private shake = 0;

  // Full-canvas celebration flash (0..1 opacity), decays to zero. Triggered on
  // a rare supernova-burst drop together with a stronger shake + special sound.
  private flash = 0;

  private readonly audio = new AudioEngine();

  private readonly history: Observation[] = [];
  private lastTime = 0;
  private rafId = 0;
  /** Pending reset timeout after a resolved shot, so stop() can clear it. */
  private resetTimeoutId = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly ui: GameUi,
    detectorId: DetectorId = "superK",
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
    this.detector = createDetector(detectorId, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.home = {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT * BALL_HOME_Y_FRACTION,
    };
    this.ball = this.makeHomeBall();

    this.attachInput();
    this.updateEnergyReadout(0);
  }

  /** Change the on-field target detector (used when re-entering play). */
  setDetector(detectorId: DetectorId): void {
    this.detector = createDetector(detectorId, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  /**
   * Re-home the ball and clear the shot lifecycle so the next run starts
   * clean. Called on every entry into the play scene (see app.ts). Without
   * this, a shot resolved in the previous run (its pending reset timeout was
   * cancelled by stop()) would leak into the next run: the leftover ball would
   * resume falling and block input until it came to rest. Cancelling any
   * pending reset timeout here makes reset idempotent and safe to call while
   * the loop is stopped.
   */
  reset(): void {
    if (this.resetTimeoutId !== 0) {
      window.clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = 0;
    }
    this.dragging = false;
    this.shake = 0;
    this.flash = 0;
    this.resetBall();
  }

  /** Expose the audio engine so the app can wire the volume slider to it. */
  getAudio(): AudioEngine {
    return this.audio;
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
    if (this.resetTimeoutId !== 0) {
      window.clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = 0;
    }
    this.detachInput();
  }

  // --- Setup helpers -------------------------------------------------------

  private makeHomeBall(): Ball {
    return createBall(this.home.x, this.home.y);
  }

  private resetBall(): void {
    this.ball = this.makeHomeBall();
    resetShotState(this.shot);
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

  private detachInput(): void {
    this.canvas.removeEventListener("mousedown", this.onDown);
    window.removeEventListener("mousemove", this.onMove);
    window.removeEventListener("mouseup", this.onUp);

    this.canvas.removeEventListener("touchstart", this.onTouchStart);
    this.canvas.removeEventListener("touchmove", this.onTouchMove);
    this.canvas.removeEventListener("touchend", this.onTouchEnd);
  }

  /** Map a client (page) coordinate to canvas space. */
  private toCanvas(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  private onDown = (e: MouseEvent): void => {
    void this.audio.resume();
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
    void this.audio.resume();
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

  /**
   * The drag vector points from the ball's HOME position toward the current
   * pointer. Measuring from home (not the pointer-down spot) keeps the
   * pullToEnergy / dragToVelocity semantics unchanged even though a drag can
   * now start anywhere on the field.
   */
  private currentDrag(): Vec2 {
    return { x: this.pointer.x - this.home.x, y: this.pointer.y - this.home.y };
  }

  private beginDrag(p: Vec2): void {
    // Only start a drag while the ball sits at home in a fresh shot (no shot
    // launched and none still resolving).
    if (!isFreshShot(this.shot)) return;
    // Drag from ANYWHERE on the field: a pointer-down anywhere starts charging.
    // The pull is always measured from the ball's home position.
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
    launchShot(this.shot, pullToEnergy(dist, MAX_PULL));
    this.ball.vel = dragToVelocity(drag, MAX_PULL);

    // Feel: a launch kick scaled by pull strength, plus the launch sound.
    const strength = Math.min(dist, MAX_PULL) / MAX_PULL;
    this.addShake(4 + strength * 10);
    this.audio.play("launch", strength);
  }

  /** Raise the shake magnitude to at least the given value. */
  private addShake(magnitude: number): void {
    this.shake = Math.max(this.shake, magnitude);
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
    // Shake decays toward zero every frame, independent of shot state.
    if (this.shake > 0) {
      this.shake *= Math.pow(1 / (1 + SHAKE_DECAY_PER_SEC), dt);
      if (this.shake < 0.2) this.shake = 0;
    }

    // Celebration flash fades out quickly.
    if (this.flash > 0) {
      this.flash -= dt * 1.6;
      if (this.flash < 0) this.flash = 0;
    }

    if (!this.shot.launched) return;

    step(this.ball, this.bounds, dt);

    if (!this.shot.resolved) {
      if (hitTest(this.detector, this.ball)) {
        this.resolveShot(this.detector);
        return;
      }
    }

    // End a shot that never reached a detector.
    if (isAtRest(this.ball, this.bounds)) {
      this.resetBall();
    }
  }

  private resolveShot(detector: Detector): void {
    resolveShotState(this.shot);
    const species = drawNeutrino(this.shot.shotEnergyMeV);
    const observation: Observation = {
      species,
      detector,
      energyMeV: this.shot.shotEnergyMeV,
    };

    if (species === RARE_SPECIES) {
      // Rare supernova burst: a bigger celebration (flash + stronger shake +
      // the sparkly special cue).
      this.addShake(28);
      this.flash = 1;
      this.audio.play("special");
    } else {
      this.addShake(16);
      this.audio.play("hit");
    }

    this.showResult(observation);
    this.history.unshift(observation);
    if (this.history.length > MAX_HISTORY) this.history.pop();
    this.renderHistory();

    // Notify the app so it can switch to the result scene and record the
    // discovery in the collection.
    this.ui.onResolve?.(observation);

    // Give the ball a brief visible bounce, then reset for the next shot.
    this.resetTimeoutId = window.setTimeout(() => {
      this.resetTimeoutId = 0;
      this.resetBall();
    }, 450);
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

    // Apply the decaying screen shake as a transform-only jitter. This never
    // touches the ball's logical coordinates; it only offsets the drawing.
    let ox = 0;
    let oy = 0;
    if (this.shake > 0) {
      ox = (Math.random() * 2 - 1) * this.shake;
      oy = (Math.random() * 2 - 1) * this.shake;
    }
    ctx.save();
    ctx.translate(ox, oy);

    ctx.clearRect(-ox, -oy, bounds.width, bounds.height);

    // Background gradient (drawn slightly oversized so the shake never exposes
    // an uncovered edge).
    const bg = ctx.createLinearGradient(0, 0, 0, bounds.height);
    bg.addColorStop(0, "#0b1026");
    bg.addColorStop(1, "#131a3a");
    ctx.fillStyle = bg;
    ctx.fillRect(-20, -20, bounds.width + 40, bounds.height + 40);

    this.renderDetector();
    this.renderAimGuide();
    this.renderBall();

    // Rare-drop celebration flash, painted over everything but kept tasteful
    // (peaks well below full white and fades out fast).
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 245, 210, ${Math.min(this.flash, 1) * 0.55})`;
      ctx.fillRect(-20, -20, bounds.width + 40, bounds.height + 40);
    }

    ctx.restore();
  }

  private renderDetector(): void {
    const { ctx } = this;
    const d = this.detector;
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

  private renderAimGuide(): void {
    if (!this.dragging) return;
    const { ctx, home } = this;
    const drag = this.currentDrag();
    const rawDist = dragDistance(drag);
    if (rawDist <= 0) return;
    const energyMeV = pullToEnergy(rawDist, MAX_PULL);
    const band = energyToBand(energyMeV);

    // True normalized pull strength (0..1): the arrow reads launch energy, so
    // a full pull is visibly bigger than a half pull (no early saturation).
    const strength = Math.min(rawDist, MAX_PULL) / MAX_PULL;
    const color = this.bandColor(band.id);

    // Pull-back line from the home position to the pointer.
    ctx.beginPath();
    ctx.moveTo(home.x, home.y);
    ctx.lineTo(this.pointer.x, this.pointer.y);
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    // Translucent launch-direction arrow (opposite of the drag). Both its
    // LENGTH and THICKNESS scale with strength so size encodes energy.
    const ux = -drag.x / rawDist;
    const uy = -drag.y / rawDist;
    const minLen = 36;
    const maxLen = 300;
    const shaftLen = minLen + strength * (maxLen - minLen);
    const shaftWidth = 6 + strength * 22;
    const headLen = 18 + strength * 26;
    const headWidth = shaftWidth + 14 + strength * 20;

    // Perpendicular unit vector for building the polygon outline.
    const px = -uy;
    const py = ux;
    const tipX = home.x + ux * shaftLen;
    const tipY = home.y + uy * shaftLen;
    const neckX = tipX - ux * headLen;
    const neckY = tipY - uy * headLen;
    const hw = shaftWidth / 2;

    ctx.beginPath();
    // Shaft start, left side.
    ctx.moveTo(home.x + px * hw, home.y + py * hw);
    ctx.lineTo(neckX + px * hw, neckY + py * hw);
    // Left barb.
    ctx.lineTo(neckX + px * (headWidth / 2), neckY + py * (headWidth / 2));
    // Tip.
    ctx.lineTo(tipX, tipY);
    // Right barb.
    ctx.lineTo(neckX - px * (headWidth / 2), neckY - py * (headWidth / 2));
    ctx.lineTo(neckX - px * hw, neckY - py * hw);
    // Shaft start, right side.
    ctx.lineTo(home.x - px * hw, home.y - py * hw);
    ctx.closePath();

    ctx.fillStyle = this.withAlpha(color, 0.38);
    ctx.fill();
    ctx.strokeStyle = this.withAlpha(color, 0.85);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Power/energy label near the home position.
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText(
      `${formatEnergy(energyMeV)} (${band.label})`,
      home.x,
      home.y + this.ball.radius + 20,
    );
  }

  /** Apply an alpha to one of the known band hex colors. */
  private withAlpha(hex: string, alpha: number): string {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) return hex;
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);
    return `rgba(${r},${g},${b},${alpha})`;
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
      : this.shot.shotEnergyMeV;
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
    if (!this.shot.launched && !this.dragging) {
      ctx.beginPath();
      ctx.arc(ball.pos.x, ball.pos.y, ball.radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(159,179,255,0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}
