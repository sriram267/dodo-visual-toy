/**
 * Tactile Audio Architecture — Procedural Web Audio Synthesizer
 * 
 * 100% procedural synthesis with ZERO external audio asset dependencies (.mp3/.wav).
 * Zero network latency, zero bundle weight, pure mathematical physics.
 * 
 * Synthesizers:
 * 1. Vacuum Whoosh: Sweeping resonant bandpass pink noise matching taffy suction flight.
 * 2. Bubble Gulp: Resonant frequency-drop sine oscillator with pop transient (synchronized at 500ms).
 * 3. Sneeze Inhale Windup: Rising intake breath noise over 380ms.
 * 4. Sneeze Explosive Blast: Tri-layer impulse burst + downward air rush + body recoil thud.
 * 5. Dry Sniffle: Dual micro-puff for empty stash sneeze attempt.
 * 6. Mascot Expressions: Warning chirp, Angry buzz, Dizzy cartoon stars vibrato.
 * 7. Polite Master Output: ~0.28 gain, mute persistence in localStorage, autoplay resumption.
 */

const STORAGE_KEY = "tusky_audio_muted";
const MASTER_VOLUME = 0.28;

type MuteListener = (muted: boolean) => void;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private pinkNoiseBuffer: AudioBuffer | null = null;
  private isMutedState = false;
  private listeners: Set<MuteListener> = new Set();
  private gestureListenerAttached = false;

  constructor() {
    this.isMutedState = false;
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      this.setupAutoResume();
    }
  }

  /**
   * Lazily initializes AudioContext and Master Gain on first user interaction.
   */
  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;

    if (!this.ctx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!AudioCtxClass) return null;

      this.ctx = new AudioCtxClass();

      // Master output bus
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(
        this.isMutedState ? 0 : MASTER_VOLUME,
        this.ctx.currentTime
      );
      this.masterGain.connect(this.ctx.destination);

      // Pre-bake 2-second pink noise buffer
      this.pinkNoiseBuffer = this.generatePinkNoiseBuffer(this.ctx);
    }

    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  /**
   * Automatically unlocks suspended Web Audio context on any user gesture.
   */
  private setupAutoResume(): void {
    if (this.gestureListenerAttached || typeof window === "undefined") return;
    this.gestureListenerAttached = true;

    const resumeHandler = () => {
      const ctx = this.getContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    };

    window.addEventListener("pointerdown", resumeHandler, { passive: true });
    window.addEventListener("mousedown", resumeHandler, { passive: true });
    window.addEventListener("keydown", resumeHandler, { passive: true });
    window.addEventListener("copy", resumeHandler, { passive: true });
    window.addEventListener("touchstart", resumeHandler, { passive: true });
  }

  /**
   * Generates a 2-second looping pink noise buffer using Paul Kellet's filtered white noise algorithm.
   * Produces authentic, warm aerodynamic wind/suction turbulence (1/f spectral slope).
   */
  private generatePinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.76160 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.09;
      b6 = white * 0.115926;
    }

    return buffer;
  }

  // ==========================================================================
  // PUBLIC CONTROLS & STATE PERSISTENCE
  // ==========================================================================

  public isMuted(): boolean {
    return this.isMutedState;
  }

  public setMuted(muted: boolean): void {
    this.isMutedState = muted;
    try {
      localStorage.setItem(STORAGE_KEY, muted ? "true" : "false");
    } catch {
      // Storage access disabled or private browsing
    }

    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(
        muted ? 0 : MASTER_VOLUME,
        now,
        0.03
      );
    }

    this.listeners.forEach((cb) => cb(this.isMutedState));
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMutedState);
    return this.isMutedState;
  }

  public subscribe(listener: MuteListener): () => void {
    this.listeners.add(listener);
    listener(this.isMutedState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ==========================================================================
  // PROCEDURAL SOUND SYNTHESIZERS
  // ==========================================================================

  /**
   * 1. VACUUM WHOOSH
   * Sweeping resonant bandpass pink noise matching taffy text suction flight.
   * Sweeps exponentially from 320Hz to 2400Hz (Q = 3.8) as words converge into trunk nozzle.
   */
  public playVacuumWhoosh(durationMs = 950): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain || !this.pinkNoiseBuffer) return;

    const now = ctx.currentTime;
    const duration = Math.max(0.4, durationMs / 1000);

    // Pink noise buffer source
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = this.pinkNoiseBuffer;
    noiseSource.loop = true;

    // Resonant bandpass filter
    const bpf = ctx.createBiquadFilter();
    bpf.type = "bandpass";
    bpf.Q.setValueAtTime(3.8, now);
    bpf.frequency.setValueAtTime(320, now);
    // Exponential upward sweep as text accelerates towards the nozzle
    bpf.frequency.exponentialRampToValueAtTime(2400, now + duration * 0.85);
    bpf.frequency.exponentialRampToValueAtTime(1200, now + duration);

    // Dynamic gain envelope
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.linearRampToValueAtTime(0.85, now + 0.06); // Fast responsive attack
    noiseGain.gain.setValueAtTime(0.85, now + duration * 0.65);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    // Subtle low suction sub-air oscillator (gives physical weight to the intake)
    const subOsc = ctx.createOscillator();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(130, now);
    subOsc.frequency.exponentialRampToValueAtTime(220, now + duration * 0.8);
    subOsc.frequency.exponentialRampToValueAtTime(90, now + duration);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.18, now + 0.05);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    // Connect audio graph
    noiseSource.connect(bpf);
    bpf.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);

    // Trigger & cleanup
    noiseSource.start(now);
    subOsc.start(now);
    noiseSource.stop(now + duration + 0.05);
    subOsc.stop(now + duration + 0.05);
  }

  /**
   * 2. BUBBLE GULP
   * Resonant sine-drop oscillator (280Hz -> 65Hz) with tactile pop transient.
   * Synchronized to fire at 500ms when text stream arrives and trunk bulges.
   */
  public playBubbleGulp(): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const GULP_DURATION = 0.075; // 75ms rubbery swallow

    // Main resonant drop sine oscillator
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + GULP_DURATION);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.0001, now);
    oscGain.gain.linearRampToValueAtTime(0.95, now + 0.004);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + GULP_DURATION);

    // High tactile pop transient (gives physical snap of a bubble swallowing)
    const popOsc = ctx.createOscillator();
    popOsc.type = "triangle";
    popOsc.frequency.setValueAtTime(620, now);
    popOsc.frequency.exponentialRampToValueAtTime(140, now + 0.018);

    const popGain = ctx.createGain();
    popGain.gain.setValueAtTime(0.0001, now);
    popGain.gain.linearRampToValueAtTime(0.35, now + 0.002);
    popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

    // Connect & trigger
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    popOsc.connect(popGain);
    popGain.connect(this.masterGain);

    osc.start(now);
    popOsc.start(now);
    osc.stop(now + GULP_DURATION + 0.01);
    popOsc.stop(now + 0.025);
  }

  /**
   * 3. SNEEZE INHALE WINDUP ("Ah... ah...")
   * Authentic physiological pre-sneeze intake:
   * - Two-stage vocal tract formant intake (throat contracts: pitch rises 200Hz -> 380Hz)
   * - Breath suction noise through vocal cavity formants (650Hz -> 1400Hz)
   * - Glottal catch (sudden silent breath hold at 340ms-380ms right before explosive release)
   */
  public playSneezeWindup(durationMs = 380): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain || !this.pinkNoiseBuffer) return;

    const now = ctx.currentTime;
    const duration = durationMs / 1000;

    // --- Layer A: Vocalized Throat Tension ("Ah... ah-") ---
    const vocalOsc = ctx.createOscillator();
    vocalOsc.type = "triangle";
    vocalOsc.frequency.setValueAtTime(210, now);
    vocalOsc.frequency.exponentialRampToValueAtTime(380, now + duration * 0.85);

    // Formant filter for open throat "Ah" vowel (~720Hz -> 960Hz)
    const vocalFilter = ctx.createBiquadFilter();
    vocalFilter.type = "bandpass";
    vocalFilter.Q.setValueAtTime(3.8, now);
    vocalFilter.frequency.setValueAtTime(680, now);
    vocalFilter.frequency.exponentialRampToValueAtTime(980, now + duration * 0.85);

    const vocalGain = ctx.createGain();
    vocalGain.gain.setValueAtTime(0.0001, now);
    // First breath intake (0% to 40%)
    vocalGain.gain.linearRampToValueAtTime(0.20, now + duration * 0.35);
    // Hesitation dip (40% to 55%)
    vocalGain.gain.linearRampToValueAtTime(0.08, now + duration * 0.52);
    // Second sharp intake gasp (55% to 85%)
    vocalGain.gain.linearRampToValueAtTime(0.28, now + duration * 0.82);
    // Glottal closure (breath-hold right before explosion)
    vocalGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.94);

    vocalOsc.connect(vocalFilter);
    vocalFilter.connect(vocalGain);
    vocalGain.connect(this.masterGain);

    // --- Layer B: Nasal / Air Inhale Turbulence ---
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = this.pinkNoiseBuffer;
    noiseSource.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.Q.setValueAtTime(2.6, now);
    noiseFilter.frequency.setValueAtTime(420, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(1450, now + duration * 0.85);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.linearRampToValueAtTime(0.26, now + duration * 0.35);
    noiseGain.gain.linearRampToValueAtTime(0.12, now + duration * 0.52);
    noiseGain.gain.linearRampToValueAtTime(0.42, now + duration * 0.82);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.94);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    vocalOsc.start(now);
    noiseSource.start(now);
    vocalOsc.stop(now + duration);
    noiseSource.stop(now + duration);
  }

  /**
   * 4. SNEEZE EXPLOSIVE BLAST ("TCH-OOO! 💨")
   * 4-Layer Authentic Sneeze Acoustics:
   * Layer 1: "TCH" Affricate Consonant Snap (sharp palatal friction release at 4.2kHz, 25ms)
   * Layer 2: "CH-OOO" Vocal Formant Core (descending vocal tract pitch 480Hz -> 190Hz through F1/F2 oral formants)
   * Layer 3: High-Velocity Air Blast (dual resonant bandpass noise expulsion + mist sizzle)
   * Layer 4: Recoil Chest Thump (deep sub-bass punch at 120Hz -> 38Hz)
   */
  public playSneezeBlast(): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain || !this.pinkNoiseBuffer) return;

    const now = ctx.currentTime;

    // ── Layer 1: Sharp "TCH" Consonant Occlusion Snap (0ms - 40ms) ──
    // The crisp phonetic release that makes the brain instantly recognize "ACHOO!"
    const tchNoise = ctx.createBufferSource();
    tchNoise.buffer = this.pinkNoiseBuffer;
    tchNoise.loop = true;

    const tchFilter = ctx.createBiquadFilter();
    tchFilter.type = "bandpass";
    tchFilter.Q.setValueAtTime(2.2, now);
    tchFilter.frequency.setValueAtTime(4200, now);

    const tchGain = ctx.createGain();
    tchGain.gain.setValueAtTime(0.0001, now);
    tchGain.gain.linearRampToValueAtTime(0.95, now + 0.002); // 2ms explosive attack
    tchGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    tchNoise.connect(tchFilter);
    tchFilter.connect(tchGain);
    tchGain.connect(this.masterGain);

    tchNoise.start(now);
    tchNoise.stop(now + 0.05);

    // ── Layer 2: Vocalized "CH-OOO" Resonant Vowel Core (0ms - 220ms) ──
    // The vocal fold blast sliding rapidly downward in pitch from 480Hz -> 180Hz
    const vocalOsc = ctx.createOscillator();
    vocalOsc.type = "sawtooth";
    vocalOsc.frequency.setValueAtTime(480, now);
    vocalOsc.frequency.exponentialRampToValueAtTime(180, now + 0.17);

    // Oral vowel formant ("oo" vowel ~420Hz)
    const f1Filter = ctx.createBiquadFilter();
    f1Filter.type = "bandpass";
    f1Filter.Q.setValueAtTime(3.8, now);
    f1Filter.frequency.setValueAtTime(540, now);
    f1Filter.frequency.exponentialRampToValueAtTime(360, now + 0.17);

    // Nasal/trunk resonance formant (~1050Hz -> 720Hz)
    const f2Filter = ctx.createBiquadFilter();
    f2Filter.type = "bandpass";
    f2Filter.Q.setValueAtTime(3.2, now);
    f2Filter.frequency.setValueAtTime(1150, now);
    f2Filter.frequency.exponentialRampToValueAtTime(750, now + 0.17);

    const vocalGain = ctx.createGain();
    vocalGain.gain.setValueAtTime(0.0001, now);
    vocalGain.gain.linearRampToValueAtTime(0.55, now + 0.006);
    vocalGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    vocalOsc.connect(f1Filter);
    vocalOsc.connect(f2Filter);
    f1Filter.connect(vocalGain);
    f2Filter.connect(vocalGain);
    vocalGain.connect(this.masterGain);

    vocalOsc.start(now);
    vocalOsc.stop(now + 0.24);

    // ── Layer 3: Turbulent Air Blast & Droplet Gust (0ms - 320ms) ──
    // High-pressure rush of expelled air down the trunk
    const airNoise = ctx.createBufferSource();
    airNoise.buffer = this.pinkNoiseBuffer;
    airNoise.loop = true;

    const airFilter = ctx.createBiquadFilter();
    airFilter.type = "bandpass";
    airFilter.Q.setValueAtTime(2.2, now);
    airFilter.frequency.setValueAtTime(2400, now);
    airFilter.frequency.exponentialRampToValueAtTime(380, now + 0.25);

    const airGain = ctx.createGain();
    airGain.gain.setValueAtTime(0.0001, now);
    airGain.gain.linearRampToValueAtTime(0.85, now + 0.005);
    airGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    airNoise.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(this.masterGain);

    airNoise.start(now);
    airNoise.stop(now + 0.30);

    // ── Layer 4: Pachyderm Torso Recoil Thump (0ms - 150ms) ──
    // Sub-bass chest punch giving visceral physical weight to the sneeze
    const thumpOsc = ctx.createOscillator();
    thumpOsc.type = "sine";
    thumpOsc.frequency.setValueAtTime(140, now);
    thumpOsc.frequency.exponentialRampToValueAtTime(36, now + 0.12);

    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0.0001, now);
    thumpGain.gain.linearRampToValueAtTime(0.5, now + 0.003);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    thumpOsc.connect(thumpGain);
    thumpGain.connect(this.masterGain);

    thumpOsc.start(now);
    thumpOsc.stop(now + 0.16);
  }

  /**
   * 5. DRY SNIFFLE (Empty Stash Sneeze Attempt)
   * Cute, unmistakable double-sniffle ("sniff... sniff!") when trunk is empty.
   */
  public playDrySniffle(): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain || !this.pinkNoiseBuffer) return;

    const playSniff = (startTime: number) => {
      // Inward nasal friction puff
      const src = ctx.createBufferSource();
      src.buffer = this.pinkNoiseBuffer;
      src.loop = true;

      const bpf = ctx.createBiquadFilter();
      bpf.type = "bandpass";
      bpf.Q.setValueAtTime(4.2, startTime);
      bpf.frequency.setValueAtTime(540, startTime);
      bpf.frequency.exponentialRampToValueAtTime(1450, startTime + 0.045);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(0.48, startTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.05);

      src.connect(bpf);
      bpf.connect(gain);
      gain.connect(this.masterGain!);

      // Subtle vocal cord intake tick
      const tick = ctx.createOscillator();
      tick.type = "sine";
      tick.frequency.setValueAtTime(280, startTime);
      tick.frequency.exponentialRampToValueAtTime(420, startTime + 0.035);

      const tickGain = ctx.createGain();
      tickGain.gain.setValueAtTime(0.0001, startTime);
      tickGain.gain.linearRampToValueAtTime(0.12, startTime + 0.004);
      tickGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.038);

      tick.connect(tickGain);
      tickGain.connect(this.masterGain!);

      src.start(startTime);
      tick.start(startTime);
      src.stop(startTime + 0.06);
      tick.stop(startTime + 0.045);
    };

    const now = ctx.currentTime;
    playSniff(now);
    playSniff(now + 0.095);
  }

  /**
   * 6A. MASCOT CLICK 1: WARNING CHIRP (🙂↔️)
   * Playful, curious double-marimba chime (440Hz -> 587Hz -> 659Hz).
   */
  public playMascotWarning(): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const playChirp = (freq: number, start: number) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.15, start + 0.055);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.4, start + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.065);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(start);
      osc.stop(start + 0.075);
    };

    playChirp(480, now);
    playChirp(640, now + 0.07);
  }

  /**
   * 6B. MASCOT CLICK 2: ANGRY BUZZ (\ /)
   * Irritated brassy jolt (260Hz -> 160Hz with lowpass filter bite).
   */
  public playMascotAngry(): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const DURATION = 0.12;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + DURATION);

    const lpf = ctx.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.setValueAtTime(650, now);
    lpf.frequency.exponentialRampToValueAtTime(280, now + DURATION);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + DURATION);

    osc.connect(lpf);
    lpf.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + DURATION + 0.02);
  }

  /**
   * 6C. MASCOT CLICK 3: DIZZY CARTOON STARS (@ @)
   * Whimsical cartoon dazed wobble (540Hz sine with 7Hz LFO vibrato decay over 650ms).
   */
  public playMascotDizzy(): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const DURATION = 0.65;

    // Carrier oscillator (540Hz)
    const carrier = ctx.createOscillator();
    carrier.type = "sine";
    carrier.frequency.setValueAtTime(540, now);
    carrier.frequency.exponentialRampToValueAtTime(420, now + DURATION);

    // Vibrato LFO modulator (7Hz, depth 35Hz)
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(7.5, now);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(36, now);
    lfoGain.gain.exponentialRampToValueAtTime(10, now + DURATION);

    lfo.connect(lfoGain);
    lfoGain.connect(carrier.frequency);

    // Amplitude decay envelope
    const ampGain = ctx.createGain();
    ampGain.gain.setValueAtTime(0.0001, now);
    ampGain.gain.linearRampToValueAtTime(0.45, now + 0.015);
    ampGain.gain.exponentialRampToValueAtTime(0.0001, now + DURATION);

    carrier.connect(ampGain);
    ampGain.connect(this.masterGain);

    carrier.start(now);
    lfo.start(now);
    carrier.stop(now + DURATION + 0.02);
    lfo.stop(now + DURATION + 0.02);
  }
}

// Export singleton engine instance
export const soundEngine = new SoundEngine();
