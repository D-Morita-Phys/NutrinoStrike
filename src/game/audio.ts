// Synthesized sound engine for Neutrino Strike.
//
// All sounds are generated at runtime with the Web Audio API: there are NO
// audio files and NO external URLs, so the game works offline on a GitHub
// Pages subpath. The engine is created lazily and the AudioContext is only
// resumed on a user gesture to satisfy browser autoplay policies.
//
// The small pure helpers (clampVolume / serializeVolume / parseStoredVolume)
// contain the volume-persistence math and are unit tested; the oscillator
// synthesis and localStorage access are not unit tested here.

/** localStorage key for the persisted master volume, namespaced to the game. */
export const VOLUME_STORAGE_KEY = "neutrino-strike:volume";

/** Default master volume (0..1) used before anything is persisted. */
export const DEFAULT_VOLUME = 0.7;

/** Clamp a volume to the inclusive [0, 1] range; NaN maps to 0. */
export function clampVolume(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Serialize a volume to the string stored in localStorage. */
export function serializeVolume(value: number): string {
  return String(clampVolume(value));
}

/**
 * Parse a stored volume string back into a clamped volume. Returns the given
 * fallback when the string is missing or not a finite number.
 */
export function parseStoredVolume(
  raw: string | null,
  fallback: number = DEFAULT_VOLUME,
): number {
  if (raw === null) return clampVolume(fallback);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return clampVolume(fallback);
  return clampVolume(parsed);
}

/** The sound cues the game can play. */
export type SoundName = "launch" | "hit" | "special";

/**
 * A minimal subset of the Web Audio surface the engine uses. Declared locally
 * so the module has no hard dependency on DOM lib typings beyond what it needs.
 */
type AudioCtx = AudioContext;

function readStoredVolume(): number {
  try {
    return parseStoredVolume(
      globalThis.localStorage?.getItem(VOLUME_STORAGE_KEY) ?? null,
    );
  } catch {
    // localStorage can throw (private mode, disabled storage). Fall back.
    return DEFAULT_VOLUME;
  }
}

function writeStoredVolume(value: number): void {
  try {
    globalThis.localStorage?.setItem(VOLUME_STORAGE_KEY, serializeVolume(value));
  } catch {
    // Ignore storage failures: volume still applies for the session.
  }
}

/**
 * Lazily-initialized Web Audio sound engine. Construct it once and share it;
 * call resume() on the first user gesture, then play(...) for cues.
 */
export class AudioEngine {
  private ctx: AudioCtx | null = null;
  private master: GainNode | null = null;
  private volume: number;

  constructor() {
    this.volume = readStoredVolume();
  }

  /**
   * Create the AudioContext and master gain on demand. Safe to call repeatedly;
   * only the first call builds the graph. Does nothing when Web Audio is
   * unavailable (e.g. during SSR or in a headless test).
   */
  init(): void {
    if (this.ctx) return;
    const Ctor: typeof AudioContext | undefined =
      typeof window !== "undefined"
        ? window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
        : undefined;
    if (!Ctor) return;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = this.volume;
    master.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;
  }

  /**
   * Resume the AudioContext, creating it first if needed. Call this from a user
   * gesture (pointerdown) so the browser permits audio. Returns a promise that
   * resolves once the context is running (or immediately if unavailable).
   */
  async resume(): Promise<void> {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        // Ignore: a later gesture may succeed.
      }
    }
  }

  /** Current master volume (0..1). */
  getVolume(): number {
    return this.volume;
  }

  /** Set and persist the master volume (0..1). Applies immediately if live. */
  setVolume(value: number): void {
    this.volume = clampVolume(value);
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(
        this.volume,
        this.ctx.currentTime,
        0.01,
      );
    }
    writeStoredVolume(this.volume);
  }

  /**
   * Play a cue. No-op when audio is unavailable or muted. `strength` (0..1)
   * nudges pitch/length for the launch cue so a stronger pull sounds punchier.
   */
  play(name: SoundName, strength = 0.5): void {
    this.init();
    if (!this.ctx || !this.master || this.volume <= 0) return;
    switch (name) {
      case "launch":
        this.playLaunch(strength);
        break;
      case "hit":
        this.playHit();
        break;
      case "special":
        this.playSpecial();
        break;
    }
  }

  // --- Synthesis -----------------------------------------------------------

  /** A rising "whoosh/pew" whose pitch climbs with pull strength. */
  private playLaunch(strength: number): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const s = clampVolume(strength);
    const startHz = 220 + s * 180;
    const endHz = 660 + s * 740;
    const dur = 0.22 + s * 0.12;

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(startHz, t0);
    osc.frequency.exponentialRampToValueAtTime(endHz, t0 + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain).connect(this.master!);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** A bright impact: short tone plus a filtered noise burst. */
  private playHit(): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const dur = 0.28;

    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(880, t0);
    osc.frequency.exponentialRampToValueAtTime(180, t0 + dur);
    const toneGain = ctx.createGain();
    toneGain.gain.setValueAtTime(0.4, t0);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(toneGain).connect(this.master!);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);

    const noise = this.makeNoiseBurst(0.12);
    if (noise) {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1800;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.35, t0);
      nGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
      noise.connect(bp).connect(nGain).connect(this.master!);
      noise.start(t0);
      noise.stop(t0 + 0.14);
    }
  }

  /** A rare, sparkly arpeggio for a special drop (used by FEAT-003). */
  private playSpecial(): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((hz, i) => {
      const t = t0 + i * 0.08;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(hz, t);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(gain).connect(this.master!);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  }

  /** Create a short white-noise source, or null if unavailable. */
  private makeNoiseBurst(seconds: number): AudioBufferSourceNode | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    return src;
  }
}
