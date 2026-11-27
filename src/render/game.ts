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
  hasArrived,
  launchBall,
  step,
} from "../game/physics.ts";
import {
  type Detector,
  type DetectorId,
  createDetector,
} from "../game/detectors.ts";
import {
  CAMERA_ZOOM_MIN,
  MAX_CHARGE_JITTER_PX,
  chargeIntensity,
  convergeToTarget,
  depthScale,
  flightProgress,
  zoomForProgress,
} from "../game/effects.ts";
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

/**
 * How fast the camera zoom eases toward its progress-driven target each frame
 * (higher = snappier catch-up). The target itself comes from flight progress;
 * this smoothing keeps the magnification from snapping between frames.
 */
const CAMERA_ZOOM_EASE_PER_SEC = 9;

/** Number of recent ball positions kept for the motion trail / afterimage. */
const TRAIL_LENGTH = 8;

export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly bounds: Bounds;
  private detector: Detector;
  private ball: Ball;

  // Drag state.
  private dragging = false;
  private pointer: Vec2 = { x: 0, y: 0 };
  /**
   * Where the current drag began (pointer-down). The pull is measured as the
   * distance from here to the live pointer, i.e. how far you dragged WITHIN the
   * shot window. There is no aim direction.
   */
  private pointerDown: Vec2 = { x: 0, y: 0 };
  /** Fixed home position where the resting ball sits (front/near the player). */
  private readonly home: Vec2;

  // Per-shot lifecycle (launched / resolved / locked-in energy). Kept as a
  // pure, reusable record so the reset invariant lives in a testable module.
  private shot: ShotState = createShotState();

  // Screen-shake state (magnitude in pixels, decays to zero over time).
  private shake = 0;

  // Full-canvas celebration flash (0..1 opacity), decays to zero. Triggered on
  // a rare supernova-burst drop together with a stronger shake + special sound.
  private flash = 0;

  // Camera zoom toward the detector during a shot (eased 1.0 -> ~2.2 in
  // render-space only; physics/hitTest stay in raw world coords). The actual
  // drawn value `cameraZoom` eases toward a progress-driven target each frame.
  private cameraZoom = CAMERA_ZOOM_MIN;

  // Recent ball positions (newest first) for the motion trail / afterimage,
  // captured each frame while a shot is in flight. Presentation-only.
  private trail: Vec2[] = [];

  // Slowly advancing angle for the spherical highlight, giving a spinning feel.
  private spin = 0;

  private readonly audio = new AudioEngine();

  private readonly history: Observation[] = [];
  private lastTime = 0;
  private rafId = 0;
  /** Pending reset timeout after a resolved shot, so stop() can clear it. */
  private resetTimeoutId = 0;
  /**
   * Whether the render/update loop is live. Checked inside the loop before
   * scheduling the next frame so that a stop() triggered from within a frame
   * (e.g. a hit that synchronously navigates away) ends the loop cleanly
   * instead of letting the current frame queue another one.
   */
  private running = false;
  /** Whether input listeners are currently attached (teardown gate). */
  private inputAttached = false;

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

    // Input is attached on start() (and re-attached on every restart), not in
    // the constructor, so the attach/detach lifecycle lives in one place.
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
    this.cameraZoom = CAMERA_ZOOM_MIN;
    this.trail = [];
    this.resetBall();
  }

  /** Expose the audio engine so the app can wire the volume slider to it. */
  getAudio(): AudioEngine {
    return this.audio;
  }

  /** True while the render/update loop is live. Exposed for tests/wiring. */
  isRunning(): boolean {
    return this.running;
  }

  /** True while input listeners are attached. Exposed for tests. */
  isInputAttached(): boolean {
    return this.inputAttached;
  }

  /**
   * Begin the render/update loop and (re-)attach input listeners. Safe to call
   * after a stop(): it re-attaches input and spins up exactly one loop. A
   * second start() while already running is a no-op, so the loop can never be
   * doubled up.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    // Re-attach input on every (re)start. attachInput() is idempotent, so
    // repeated start/stop cycles never register duplicate listeners.
    this.attachInput();
    this.lastTime = performance.now();
    const loop = (now: number) => {
      // A stop() from inside the previous frame flips running off; bail before
      // doing any work or scheduling another frame.
      if (!this.running) return;
      const dt = Math.min((now - this.lastTime) / 1000, 1 / 30);
      this.lastTime = now;
      this.update(dt);
      this.render();
      // Re-check: update() may have resolved a shot whose onResolve navigated
      // away and called stop() synchronously. Only queue the next frame while
      // still running.
      if (!this.running) return;
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  /**
   * Stop the render/update loop. The loop is torn down (running=false +
   * cancelAnimationFrame) and any pending reset timeout is cleared, but input
   * listeners stay attached so a later start() can resume accepting shots.
   * Idempotent and safe to call from within a frame. Use destroy() for the
   * permanent teardown that also removes input listeners.
   */
  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    if (this.resetTimeoutId !== 0) {
      window.clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = 0;
    }
  }

  /**
   * Permanent teardown: stop the loop AND remove input listeners. After this
   * the Game should not be reused. Kept separate from stop() so that ordinary
   * leave/return cycles (stop then start) keep input working.
   */
  destroy(): void {
    this.stop();
    this.detachInput();
  }

  // --- Setup helpers -------------------------------------------------------

  private makeHomeBall(): Ball {
    return createBall(this.home.x, this.home.y);
  }

  private resetBall(): void {
    this.ball = this.makeHomeBall();
    resetShotState(this.shot);
    // Clear per-shot camera/trail FX so no stale zoom or afterimage leaks into
    // the next shot (whether we got here via rest, resolve or re-entry).
    this.cameraZoom = CAMERA_ZOOM_MIN;
    this.trail = [];
    this.updateEnergyReadout(0);
  }

  // --- Input ---------------------------------------------------------------

  private attachInput(): void {
    if (this.inputAttached) return;
    this.inputAttached = true;
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
    if (!this.inputAttached) return;
    this.inputAttached = false;
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
   * How far the pointer has been dragged WITHIN the shot window, measured from
   * the pointer-down spot to the live pointer. MAGNITUDE ONLY: there is no aim
   * direction, so only the distance matters. This drives both the energy
   * readout (pullToEnergy) and the launch depth-speed.
   */
  private pullDistance(): number {
    return Math.hypot(
      this.pointer.x - this.pointerDown.x,
      this.pointer.y - this.pointerDown.y,
    );
  }

  private beginDrag(p: Vec2): void {
    // Only start a drag while the ball sits at home in a fresh shot (no shot
    // launched and none still resolving).
    if (!isFreshShot(this.shot)) return;
    // Drag from ANYWHERE on the field: a pointer-down anywhere starts charging.
    // The pull is measured as the distance dragged from this pointer-down spot,
    // not from the ball's home position.
    this.dragging = true;
    this.pointerDown = p;
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
    const dist = this.pullDistance();
    if (dist < 4) {
      // A tap, not a pull: do not launch.
      this.updateEnergyReadout(0);
      return;
    }
    // Lock in the energy for this shot from the pull strength, then launch.
    // Only the pull MAGNITUDE matters; the ball always flies into depth toward
    // the detector. We feed the magnitude through a direction-free drag vector.
    launchShot(this.shot, pullToEnergy(dist, MAX_PULL));
    launchBall(this.ball, { x: dist, y: 0 }, MAX_PULL);

    // Start the per-shot camera zoom from its base; it advances in update()
    // based on flight progress toward the detector. No full-canvas launch
    // shake any more: the charge-time shake lives on the ball only.
    this.cameraZoom = CAMERA_ZOOM_MIN;
    this.trail = [];
    const strength = Math.min(dist, MAX_PULL) / MAX_PULL;
    this.audio.play("launch", strength);
  }

  /** Raise the shake magnitude to at least the given value. */
  private addShake(magnitude: number): void {
    this.shake = Math.max(this.shake, magnitude);
  }

  private updateEnergyFromDrag(): void {
    this.updateEnergyReadout(pullToEnergy(this.pullDistance(), MAX_PULL));
  }

  private updateEnergyReadout(energyMeV: number): void {
    const band = energyToBand(energyMeV);
    this.ui.energyReadout.textContent =
      energyMeV > 0
        ? `Pull energy: ${formatEnergy(energyMeV)} (${band.label})`
        : "Drag anywhere to charge, then release to fire toward the detector.";
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

    // Slow spin for the ball highlight (presentation only).
    this.spin = (this.spin + dt * 2.2) % (Math.PI * 2);

    if (!this.shot.launched) {
      // No shot in flight: ease the camera back to its base so any residual
      // zoom from a just-finished shot settles smoothly.
      this.easeCameraToward(CAMERA_ZOOM_MIN, dt);
      return;
    }

    step(this.ball, this.bounds, dt);

    // Record the ball's DRAWN (converging) position for the motion trail so the
    // afterimage recedes toward the detector with the ball (newest first).
    this.trail.unshift(this.drawnBallPos());
    if (this.trail.length > TRAIL_LENGTH) this.trail.length = TRAIL_LENGTH;

    // Advance the detector zoom from depth progress (0 at launch, 1 at the
    // back/detector plane). Drawing-only.
    const progress = flightProgress(this.ball.depth);
    this.easeCameraToward(zoomForProgress(progress), dt);

    // Resolve the shot the instant the ball reaches the detector plane at the
    // back. In the depth model a launched shot always arrives (no falling
    // short), so there is no at-rest reset path any more.
    if (!this.shot.resolved && hasArrived(this.ball)) {
      this.resolveShot(this.detector);
      return;
    }
  }

  /** Smoothly ease the drawn camera zoom toward a target (frame-rate safe). */
  private easeCameraToward(target: number, dt: number): void {
    const k = 1 - Math.pow(1 / (1 + CAMERA_ZOOM_EASE_PER_SEC), dt);
    this.cameraZoom += (target - this.cameraZoom) * k;
    if (Math.abs(this.cameraZoom - target) < 0.001) this.cameraZoom = target;
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
    // Clear in untransformed screen space first.
    ctx.clearRect(0, 0, bounds.width, bounds.height);

    // OUTER transform: the decaying screen shake as a transform-only jitter.
    // This never touches any logical coordinates; it only offsets the drawing.
    ctx.save();
    ctx.translate(ox, oy);

    // INNER transform: focal-point camera zoom toward the detector center. We
    // translate to the detector center, scale, then translate back so the
    // detector stays fixed while the scene magnifies into it. Drawing-only;
    // hitTest()/step() still run in raw world coords.
    ctx.save();
    if (this.cameraZoom !== 1) {
      const d = this.detector;
      ctx.translate(d.x, d.y);
      ctx.scale(this.cameraZoom, this.cameraZoom);
      ctx.translate(-d.x, -d.y);
    }

    // Background gradient (drawn well oversized so neither the shake nor the
    // zoom ever exposes an uncovered edge).
    const bg = ctx.createLinearGradient(0, 0, 0, bounds.height);
    bg.addColorStop(0, "#0b1026");
    bg.addColorStop(1, "#131a3a");
    ctx.fillStyle = bg;
    ctx.fillRect(-bounds.width, -bounds.height, bounds.width * 3, bounds.height * 3);

    this.renderDetector();
    this.renderAimGuide();
    this.renderTrail();
    this.renderBall();

    // Close the camera-zoom transform; the flash is painted in screen space.
    ctx.restore();

    // Rare-drop celebration flash, painted over everything but kept tasteful
    // (peaks well below full white and fades out fast). Drawn after the zoom is
    // restored so it stays a full-screen overlay regardless of magnification.
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

  /**
   * Magnitude-only charge gauge shown while dragging. There is NO aim
   * direction: the ball always fires toward the detector, so instead of a
   * launch arrow we draw a charge meter that reads pull STRENGTH only.
   *
   * It has two parts, both coloured by the current energy band:
   *  - a growing ring around the resting ball whose radius tracks strength;
   *  - a horizontal energy bar + readout under the ball.
   * Styling stays translucent to match the previous aim guide.
   */
  private renderAimGuide(): void {
    if (!this.dragging) return;
    const { ctx, home } = this;
    const rawDist = this.pullDistance();
    if (rawDist <= 0) return;
    const energyMeV = pullToEnergy(rawDist, MAX_PULL);
    const band = energyToBand(energyMeV);

    // Normalized pull strength (0..1): full pull reads visibly stronger.
    const strength = Math.min(rawDist, MAX_PULL) / MAX_PULL;
    const color = this.bandColor(band.id);

    // Growing charge ring around the resting ball. Its radius and thickness
    // both scale with strength, so size encodes energy with no direction.
    const minR = this.ball.radius + 10;
    const maxR = this.ball.radius + 96;
    const ringR = minR + strength * (maxR - minR);
    ctx.beginPath();
    ctx.arc(home.x, home.y, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = this.withAlpha(color, 0.7);
    ctx.lineWidth = 3 + strength * 7;
    ctx.stroke();

    // Filled charge arc from the top, sweeping clockwise with strength, for a
    // gauge-needle feel.
    ctx.beginPath();
    ctx.arc(
      home.x,
      home.y,
      ringR,
      -Math.PI / 2,
      -Math.PI / 2 + strength * Math.PI * 2,
    );
    ctx.strokeStyle = this.withAlpha(color, 0.95);
    ctx.lineWidth = 5 + strength * 7;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.lineCap = "butt";

    // Horizontal energy bar under the ball.
    const barW = 160;
    const barH = 10;
    const barX = home.x - barW / 2;
    const barY = home.y + this.ball.radius + 28;
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = this.withAlpha(color, 0.9);
    ctx.fillRect(barX, barY, barW * strength, barH);
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // Energy readout text under the bar.
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText(
      `${formatEnergy(energyMeV)} (${band.label})`,
      home.x,
      barY + barH + 16,
    );
  }

  /**
   * The DRAWN ball center for the current frame. At home (no launch) it is the
   * fixed home position; in flight it converges from home toward the detector
   * center as depth -> 1 (the vanishing point). Draw-only: ball.pos is never
   * mutated, so physics/arrival stay in their own coordinate space.
   */
  private drawnBallPos(): Vec2 {
    if (!this.shot.launched) {
      return { x: this.home.x, y: this.home.y };
    }
    const f = convergeToTarget(this.ball.depth);
    const d = this.detector;
    return {
      x: this.home.x + (d.x - this.home.x) * f,
      y: this.home.y + (d.y - this.home.y) * f,
    };
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

  /** Energy-driven glow color for the ball, by current drag or locked shot. */
  private ballGlowColor(): string {
    const energyMeV = this.dragging
      ? pullToEnergy(this.pullDistance(), MAX_PULL)
      : this.shot.shotEnergyMeV;
    return energyMeV > 0 ? this.bandColor(energyToBand(energyMeV).id) : "#9fb3ff";
  }

  /**
   * Fading, shrinking afterimages behind the launched ball. Presentation-only:
   * reads the recorded world positions and draws echoes that get smaller and
   * more transparent the older they are. The newest sample is the live ball,
   * so we skip index 0 to avoid double-drawing it.
   */
  private renderTrail(): void {
    if (!this.shot.launched || this.trail.length < 2) return;
    const { ctx } = this;
    const glow = this.ballGlowColor();
    const n = this.trail.length;
    for (let i = n - 1; i >= 1; i--) {
      const p = this.trail[i];
      const t = i / n; // 0 (newest-ish) -> 1 (oldest)
      const r = this.ball.radius * depthScale(this.ball.depth) * (1 - t * 0.55);
      const alpha = 0.28 * (1 - t);
      if (r <= 0 || alpha <= 0.01) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = this.withAlpha(glow, alpha);
      ctx.fill();
    }
  }

  /**
   * Draw the ball as a lit 3D sphere flung into depth (Monster Strike gacha
   * feel), entirely in Canvas 2D:
   *  - depth RENDER scale from flight progress (shrinks toward the detector);
   *  - offset radial-gradient highlight + rim/terminator for sphere shading;
   *  - a soft contact shadow/halo under the ball;
   *  - a small charge-time jitter while dragging (ball-only, intensity scales
   *    with pull strength) that never mutates ball.pos.
   * None of this changes ball.radius, which stays authoritative for hitTest.
   */
  private renderBall(): void {
    const { ctx, ball } = this;

    // Ball-only charge jitter while dragging: offset the DRAWN position only.
    let jx = 0;
    let jy = 0;
    if (this.dragging) {
      const intensity = chargeIntensity(this.pullDistance(), MAX_PULL);
      const amp = intensity * MAX_CHARGE_JITTER_PX;
      jx = (Math.random() * 2 - 1) * amp;
      jy = (Math.random() * 2 - 1) * amp;
    }
    // Converge the DRAWN position toward the detector center as depth -> 1, so
    // the ball recedes into the vanishing point at the back. Draw-only: it
    // reads ball.depth but never mutates ball.pos (authoritative for logic).
    const drawn = this.drawnBallPos();
    const cx = drawn.x + jx;
    const cy = drawn.y + jy;

    // Depth render scale while in flight (never while at home/charging, so the
    // resting and charging ball keep their full size). The ball reads slightly
    // larger up close and SHRINKS as it recedes toward the detector. RENDER
    // only; ball.radius used by logic is never changed.
    const scale = this.shot.launched ? depthScale(ball.depth) : 1;
    const r = ball.radius * scale;

    const glow = this.ballGlowColor();

    // Soft contact shadow / halo beneath the sphere.
    const halo = ctx.createRadialGradient(cx, cy + r * 0.2, r * 0.2, cx, cy + r * 0.2, r * 1.9);
    halo.addColorStop(0, this.withAlpha(glow, 0.35));
    halo.addColorStop(1, this.withAlpha(glow, 0));
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.2, r * 1.9, 0, Math.PI * 2);
    ctx.fillStyle = halo;
    ctx.fill();

    // Sphere body with an OFFSET highlight so it reads as lit from upper-left.
    // The highlight offset rotates slowly with `spin` for a spinning feel.
    const hx = cx + Math.cos(this.spin) * r * 0.38;
    const hy = cy - r * 0.38 + Math.sin(this.spin) * r * 0.12;
    const grad = ctx.createRadialGradient(hx, hy, r * 0.1, cx, cy, r);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.45, glow);
    grad.addColorStop(1, this.shadeDarker(glow));
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Rim / terminator: a bright arc on the lit side, fading into shadow.
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.stroke();

    // Specular glint.
    ctx.beginPath();
    ctx.arc(hx, hy, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fill();

    // At-rest ring hint when the ball is ready to shoot.
    if (!this.shot.launched && !this.dragging) {
      ctx.beginPath();
      ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(159,179,255,0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  /** Darken a known band hex color for the sphere's shadow side. */
  private shadeDarker(hex: string): string {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) return hex;
    const r = Math.round(parseInt(m[1], 16) * 0.35);
    const g = Math.round(parseInt(m[2], 16) * 0.35);
    const b = Math.round(parseInt(m[3], 16) * 0.35);
    return `rgb(${r},${g},${b})`;
  }
}
