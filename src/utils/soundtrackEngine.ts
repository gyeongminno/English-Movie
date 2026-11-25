import type { TimedLine } from "../types";

/**
 * Creates a soft stereo room impulse response for delicate piano, marimba, and strings.
 */
function createWarmRoomImpulse(
  ctx: BaseAudioContext,
  durationSec = 1.6,
  decay = 2.6
): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * durationSec);
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const env = Math.pow(1 - i / length, decay);
      // Warm damped noise (simple 1-pole LP feel)
      const white = Math.random() * 2 - 1;
      const prev = i > 0 ? data[i - 1] : 0;
      data[i] = (prev * 0.55 + white * 0.45) * env * 0.35;
    }
  }
  return impulse;
}

/**
 * Soft felt-piano note synthesis with warm harmonics and gentle attack.
 */
function triggerFeltPiano(
  ctx: BaseAudioContext,
  dest: AudioNode,
  freq: number,
  startTime: number,
  dur: number,
  gainAmount: number
) {
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const amp = ctx.createGain();

  osc1.type = "triangle";
  osc1.frequency.setValueAtTime(freq, startTime);

  osc2.type = "sine";
  osc2.frequency.setValueAtTime(freq * 2, startTime);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(Math.min(2400, freq * 4.2), startTime);
  filter.frequency.exponentialRampToValueAtTime(
    Math.max(420, freq * 1.4),
    startTime + dur
  );

  amp.gain.setValueAtTime(0.0001, startTime);
  amp.gain.linearRampToValueAtTime(gainAmount, startTime + 0.022);
  amp.gain.exponentialRampToValueAtTime(gainAmount * 0.45, startTime + dur * 0.35);
  amp.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

  const overtoneGain = ctx.createGain();
  overtoneGain.gain.value = 0.22;

  osc1.connect(filter);
  osc2.connect(overtoneGain);
  overtoneGain.connect(filter);
  filter.connect(amp);
  amp.connect(dest);

  osc1.start(startTime);
  osc2.start(startTime);
  osc1.stop(startTime + dur + 0.05);
  osc2.stop(startTime + dur + 0.05);
}

/**
 * Soft pizzicato string pluck (for Beat 2 gentle nervousness).
 */
function triggerPizzicato(
  ctx: BaseAudioContext,
  dest: AudioNode,
  freq: number,
  startTime: number,
  gainAmount: number
) {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const amp = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, startTime);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1600, startTime);
  filter.frequency.exponentialRampToValueAtTime(340, startTime + 0.26);

  amp.gain.setValueAtTime(0.0001, startTime);
  amp.gain.linearRampToValueAtTime(gainAmount, startTime + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.28);

  osc.connect(filter);
  filter.connect(amp);
  amp.connect(dest);

  osc.start(startTime);
  osc.stop(startTime + 0.32);
}

/**
 * Gentle wooden marimba note (for Beat 3 discovery & hope).
 */
function triggerMarimba(
  ctx: BaseAudioContext,
  dest: AudioNode,
  freq: number,
  startTime: number,
  gainAmount: number
) {
  const osc = ctx.createOscillator();
  const harmonic = ctx.createOscillator();
  const harmGain = ctx.createGain();
  const amp = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, startTime);

  harmonic.type = "sine";
  harmonic.frequency.setValueAtTime(freq * 4, startTime);
  harmGain.gain.setValueAtTime(gainAmount * 0.18, startTime);
  harmGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.06);

  amp.gain.setValueAtTime(0.0001, startTime);
  amp.gain.linearRampToValueAtTime(gainAmount, startTime + 0.006);
  amp.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.45);

  osc.connect(amp);
  harmonic.connect(harmGain);
  harmGain.connect(amp);
  amp.connect(dest);

  osc.start(startTime);
  harmonic.start(startTime);
  osc.stop(startTime + 0.5);
  harmonic.stop(startTime + 0.1);
}

/**
 * Soft sustained warm string swell.
 */
function triggerSoftString(
  ctx: BaseAudioContext,
  dest: AudioNode,
  freq: number,
  startTime: number,
  dur: number,
  gainAmount: number
) {
  const oscA = ctx.createOscillator();
  const oscB = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const amp = ctx.createGain();

  oscA.type = "sawtooth";
  oscA.frequency.setValueAtTime(freq * 0.9985, startTime);
  oscB.type = "sawtooth";
  oscB.frequency.setValueAtTime(freq * 1.0015, startTime);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(780, startTime);
  filter.frequency.linearRampToValueAtTime(1150, startTime + dur * 0.5);
  filter.frequency.linearRampToValueAtTime(620, startTime + dur);

  amp.gain.setValueAtTime(0.0001, startTime);
  amp.gain.linearRampToValueAtTime(gainAmount, startTime + Math.min(0.65, dur * 0.3));
  amp.gain.setValueAtTime(gainAmount, startTime + Math.max(0.66, dur - 0.8));
  amp.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

  oscA.connect(filter);
  oscB.connect(filter);
  filter.connect(amp);
  amp.connect(dest);

  oscA.start(startTime);
  oscB.start(startTime);
  oscA.stop(startTime + dur + 0.05);
  oscB.stop(startTime + dur + 0.05);
}

/**
 * Restrained muted percussion / ceramic foley thud & roll.
 */
function triggerSoftFoley(
  ctx: BaseAudioContext,
  dest: AudioNode,
  kind: "tilt-thud" | "slot-click" | "roll-soft" | "brush-pulse",
  startTime: number
) {
  if (kind === "tilt-thud") {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(135, startTime);
    osc.frequency.exponentialRampToValueAtTime(52, startTime + 0.14);
    amp.gain.setValueAtTime(0.0001, startTime);
    amp.gain.linearRampToValueAtTime(0.16, startTime + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.18);
    osc.connect(amp);
    amp.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + 0.2);
  } else if (kind === "slot-click") {
    // Soft satisfying ceramic fit resonance + warm harmonic bell
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(196, startTime);
    osc.frequency.exponentialRampToValueAtTime(110, startTime + 0.12);
    amp.gain.setValueAtTime(0.001, startTime);
    amp.gain.linearRampToValueAtTime(0.15, startTime + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22);
    osc.connect(amp);
    amp.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + 0.24);
  } else if (kind === "roll-soft") {
    // Filtered soft noise swish for sphere rolling
    const len = Math.floor(ctx.sampleRate * 0.25);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 340;
    bp.Q.value = 1.6;
    const amp = ctx.createGain();
    amp.gain.value = 0.06;
    src.connect(bp);
    bp.connect(amp);
    amp.connect(dest);
    src.start(startTime);
  } else {
    // Restrained muted brush pulse
    const len = Math.floor(ctx.sampleRate * 0.08);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 950;
    const amp = ctx.createGain();
    amp.gain.value = 0.045;
    src.connect(lp);
    lp.connect(amp);
    amp.connect(dest);
    src.start(startTime);
  }
}

/**
 * Generates one continuous 30.00-second stereo instrumental soundtrack + subtle foley SFX
 * following the 4-beat emotional arc:
 *  - 0–7s: Loneliness & curiosity (quiet delicate piano + ambient pad)
 *  - 7–15s: Nervousness & frustration (soft pizzicato strings, restrained percussion, tilt/fall SFX)
 *  - 15–23s: Discovery, courage & hope (hopeful piano chords, marimba, soft strings, bridge accent)
 *  - 23–30s: Warmth, acceptance & happiness (warm original piano motif + lush strings, peaceful resolution)
 */
export async function generateOriginalSoundtrack(
  seed = 1,
  sampleRate = 48000
): Promise<AudioBuffer> {
  const durationSec = 30;
  const offline = new OfflineAudioContext(2, durationSec * sampleRate, sampleRate);

  const dryBus = offline.createGain();
  dryBus.gain.value = 0.78;
  dryBus.connect(offline.destination);

  const wetBus = offline.createGain();
  wetBus.gain.value = 0.32;
  const convolver = offline.createConvolver();
  convolver.buffer = createWarmRoomImpulse(offline, 1.8, 2.8);
  wetBus.connect(convolver);
  convolver.connect(offline.destination);

  const musicBus = offline.createGain();
  musicBus.gain.setValueAtTime(0.001, 0);
  musicBus.gain.linearRampToValueAtTime(0.88, 0.5);
  musicBus.gain.setValueAtTime(0.88, 27.6);
  musicBus.gain.linearRampToValueAtTime(0.0001, 29.92);
  musicBus.connect(dryBus);
  musicBus.connect(wetBus);

  const foleyBus = offline.createGain();
  foleyBus.gain.value = 0.72;
  foleyBus.connect(dryBus);

  // Pitch shift factor subtle variation when user clicks "Regenerate Music"
  // Alternates gently between F major (1.0), G major (1.122), or Eb major (0.891)
  const keyOffsets = [1.0, 1.12246, 0.8909, 1.05946];
  const keyMul = keyOffsets[Math.abs(seed - 1) % keyOffsets.length];
  const f = (hz: number) => hz * keyMul;

  // --- BEAT 1 (0–7s): Quiet delicate piano melody + subtle ambient pad (Loneliness & curiosity) ---
  triggerSoftString(offline, musicBus, f(174.61), 0.1, 6.8, 0.045); // F3 pad
  triggerSoftString(offline, musicBus, f(261.63), 0.8, 6.0, 0.03); // C4 airy fifth

  const b1Notes: Array<[number, number, number]> = [
    [0.35, 349.23, 1.8], // F4
    [1.35, 523.25, 1.5], // C5
    [2.35, 659.25, 1.8], // E5
    [3.55, 587.33, 1.7], // D5
    [4.65, 440.0, 1.8],  // A4
    [5.85, 392.0, 1.6],  // G4
  ];
  b1Notes.forEach(([t, hz, dur]) => {
    const varHz = seed % 2 === 0 && t > 4 ? hz * 1.122 : hz;
    triggerFeltPiano(offline, musicBus, f(varHz), t, dur, 0.17);
  });

  // Gentle rolling ambience in Beat 1 as spheres pass by
  triggerSoftFoley(offline, foleyBus, "roll-soft", 1.2);
  triggerSoftFoley(offline, foleyBus, "roll-soft", 3.4);

  // --- BEAT 2 (7–15s): Soft pizzicato strings, restrained irregular rhythm + tilt/fall foley ---
  const b2Pizz: Array<[number, number]> = [
    [7.15, 293.66], // D4
    [7.65, 349.23], // F4
    [8.20, 440.0],  // A4
    [8.85, 329.63], // E4
    [9.40, 466.16], // Bb4
    [10.05, 349.23],
    [10.60, 440.0],
    [11.20, 392.0],
    [11.75, 329.63],
    [12.40, 293.66],
    [13.05, 349.23],
    [13.70, 415.3],
    [14.35, 392.0],
  ];
  b2Pizz.forEach(([t, hz], idx) => {
    triggerPizzicato(offline, musicBus, f(hz), t, 0.14);
    if (idx % 2 === 0) {
      triggerSoftFoley(offline, foleyBus, "brush-pulse", t);
    }
  });

  // Subtle low piano bass notes for grounded tension
  triggerFeltPiano(offline, musicBus, f(146.83), 7.2, 2.4, 0.12); // D3
  triggerFeltPiano(offline, musicBus, f(130.81), 10.6, 2.2, 0.12); // C3
  triggerFeltPiano(offline, musicBus, f(116.54), 13.2, 1.8, 0.11); // Bb2

  // Synchronized tilt & fall foley in Beat 2
  triggerSoftFoley(offline, foleyBus, "tilt-thud", 8.55);
  triggerSoftFoley(offline, foleyBus, "tilt-thud", 11.45);

  // --- BEAT 3 (15–23s): Resolution -> Discovery, courage & hope (warm piano chords, marimba, strings) ---
  triggerSoftString(offline, musicBus, f(233.08), 15.1, 4.0, 0.06); // Bb3
  triggerSoftString(offline, musicBus, f(261.63), 19.0, 4.2, 0.07); // C4

  // Warm piano chords
  [
    [15.2, [233.08, 349.23, 440.0], 2.4], // Bbmaj7
    [17.6, [261.63, 392.0, 493.88], 2.2], // Cmaj/9 feel
    [19.2, [174.61, 349.23, 440.0, 523.25], 3.5], // Fmaj7 warm realization
  ].forEach(([t, freqs, dur]) => {
    (freqs as number[]).forEach((hz) => {
      triggerFeltPiano(offline, musicBus, f(hz), t as number, dur as number, 0.11);
    });
  });

  // Gentle marimba arpeggio + bridge placement accent at ~18.9s
  const marimbaCues: Array<[number, number]> = [
    [15.5, 587.33],
    [16.0, 698.46],
    [16.5, 659.25],
    [17.2, 523.25],
    [18.1, 587.33],
    [18.95, 698.46], // Bridge moment!
    [19.45, 880.0],
    [20.0, 783.99],
    [20.6, 698.46],
    [21.2, 659.25],
    [21.9, 587.33],
  ];
  marimbaCues.forEach(([t, hz]) => {
    triggerMarimba(offline, musicBus, f(hz), t, 0.14);
  });

  // Bridge foley + safe sphere rolling crossing SFX
  triggerSoftFoley(offline, foleyBus, "slot-click", 18.92);
  triggerSoftFoley(offline, foleyBus, "roll-soft", 19.8);
  triggerSoftFoley(offline, foleyBus, "roll-soft", 20.7);
  triggerSoftFoley(offline, foleyBus, "roll-soft", 21.6);

  // --- BEAT 4 (23–30s): Return to original piano melody transformed warmer + strings + peaceful resolution ---
  triggerSoftString(offline, musicBus, f(174.61), 23.0, 6.8, 0.085); // F3
  triggerSoftString(offline, musicBus, f(261.63), 23.2, 6.6, 0.065); // C4
  triggerSoftString(offline, musicBus, f(440.0), 24.5, 5.3, 0.045);  // A4

  const b4Melody: Array<[number, number, number]> = [
    [23.2, 349.23, 1.8], // F4
    [24.0, 523.25, 1.6], // C5
    [24.9, 659.25, 1.8], // E5
    [25.8, 698.46, 2.0], // F5 (hopeful lift!)
    [26.8, 659.25, 2.2], // E5
    [27.8, 523.25, 2.2], // C5
    [28.5, 440.0, 1.6],  // A4
  ];
  b4Melody.forEach(([t, hz, dur]) => {
    triggerFeltPiano(offline, musicBus, f(hz), t, dur, 0.16);
  });

  // Final warm peaceful resolution chord
  [174.61, 261.63, 349.23, 440.0, 523.25].forEach((hz) => {
    triggerFeltPiano(offline, musicBus, f(hz), 27.9, 2.1, 0.09);
  });

  return await offline.startRendering();
}

/**
 * Schedules automatic volume ducking on a GainNode whenever characters speak.
 */
export function buildDuckingEnvelope(
  gainNode: AudioParam,
  baseVolume: number,
  timedLines: TimedLine[],
  startTimeInCtx: number,
  offsetSec: number
) {
  const ducked = baseVolume * 0.36; // ~ -9 dB ducking during dialogue
  const fade = 0.2;

  gainNode.cancelScheduledValues(startTimeInCtx);
  const currentlySpeaking = timedLines.some(
    (l) => offsetSec >= l.startSec - 0.1 && offsetSec <= l.endSec + 0.1
  );
  gainNode.setValueAtTime(
    currentlySpeaking ? ducked : baseVolume,
    startTimeInCtx
  );

  for (const line of timedLines) {
    if (line.endSec <= offsetSec) continue;
    const relStart = Math.max(0, line.startSec - offsetSec);
    const relEnd = Math.max(0, line.endSec - offsetSec);
    const duckAt = startTimeInCtx + Math.max(0, relStart - fade);
    const restoreAt = startTimeInCtx + relEnd;

    gainNode.setValueAtTime(baseVolume, duckAt);
    gainNode.linearRampToValueAtTime(ducked, startTimeInCtx + relStart);
    gainNode.setValueAtTime(ducked, restoreAt);
    gainNode.linearRampToValueAtTime(baseVolume, restoreAt + fade * 1.4);
  }
}

/**
 * Decodes a user-uploaded royalty-free instrumental audio file and trims/pads it to 30 seconds.
 */
export async function decodeCustomMusicFile(file: File): Promise<AudioBuffer> {
  const arr = await file.arrayBuffer();
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(arr);
    const sampleRate = 48000;
    const offline = new OfflineAudioContext(2, 30 * sampleRate, sampleRate);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.loop = decoded.duration < 30;

    const gain = offline.createGain();
    gain.gain.setValueAtTime(0.001, 0);
    gain.gain.linearRampToValueAtTime(0.9, 0.5);
    gain.gain.setValueAtTime(0.9, 28.0);
    gain.gain.linearRampToValueAtTime(0.0001, 29.95);

    src.connect(gain);
    gain.connect(offline.destination);
    src.start(0);
    src.stop(30);
    return await offline.startRendering();
  } finally {
    await ctx.close().catch(() => undefined);
  }
}
