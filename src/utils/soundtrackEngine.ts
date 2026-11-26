import type { TimedLine } from "../types";

/**
 * Creates a soft stereo room impulse response for delicate piano, pizzicato, xylophone, and bells.
 */
function createWarmRoomImpulse(
  ctx: BaseAudioContext,
  durationSec = 1.6,
  decay = 2.7
): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * durationSec);
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const env = Math.pow(1 - i / length, decay);
      const white = Math.random() * 2 - 1;
      const prev = i > 0 ? data[i - 1] : 0;
      data[i] = (prev * 0.58 + white * 0.42) * env * 0.3;
    }
  }
  return impulse;
}

/**
 * Soft, warm felt acoustic piano tone.
 */
function triggerFeltPiano(
  ctx: BaseAudioContext,
  dest: AudioNode,
  freq: number,
  startTime: number,
  dur: number,
  gainAmount: number
) {
  if (startTime < 0) return;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const amp = ctx.createGain();

  osc1.type = "triangle";
  osc1.frequency.setValueAtTime(freq, startTime);

  osc2.type = "sine";
  osc2.frequency.setValueAtTime(freq * 2, startTime);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(Math.min(2200, freq * 3.8), startTime);
  filter.frequency.exponentialRampToValueAtTime(
    Math.max(380, freq * 1.35),
    startTime + dur
  );

  amp.gain.setValueAtTime(0.0001, startTime);
  amp.gain.linearRampToValueAtTime(gainAmount, startTime + 0.018);
  amp.gain.exponentialRampToValueAtTime(
    Math.max(0.0002, gainAmount * 0.42),
    startTime + Math.max(0.06, dur * 0.38)
  );
  amp.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

  const overtoneGain = ctx.createGain();
  overtoneGain.gain.value = 0.16;

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
 * Subtle plucked pizzicato string sound.
 */
function triggerPizzicato(
  ctx: BaseAudioContext,
  dest: AudioNode,
  freq: number,
  startTime: number,
  gainAmount: number
) {
  if (startTime < 0) return;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const amp = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, startTime);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1450, startTime);
  filter.frequency.exponentialRampToValueAtTime(340, startTime + 0.22);

  amp.gain.setValueAtTime(0.0001, startTime);
  amp.gain.linearRampToValueAtTime(gainAmount, startTime + 0.006);
  amp.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.24);

  osc.connect(filter);
  filter.connect(amp);
  amp.connect(dest);

  osc.start(startTime);
  osc.stop(startTime + 0.28);
}

/**
 * Gentle, warm wooden xylophone / marimba resonance.
 */
function triggerGentleXylophone(
  ctx: BaseAudioContext,
  dest: AudioNode,
  freq: number,
  startTime: number,
  dur: number,
  gainAmount: number
) {
  if (startTime < 0) return;
  const fundamental = ctx.createOscillator();
  const harmonic = ctx.createOscillator();
  const harmonicGain = ctx.createGain();
  const amp = ctx.createGain();

  fundamental.type = "sine";
  fundamental.frequency.setValueAtTime(freq, startTime);

  harmonic.type = "sine";
  harmonic.frequency.setValueAtTime(freq * 4, startTime);
  harmonicGain.gain.setValueAtTime(0.18, startTime);
  harmonicGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.14);

  amp.gain.setValueAtTime(0.0001, startTime);
  amp.gain.linearRampToValueAtTime(gainAmount, startTime + 0.005);
  amp.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

  fundamental.connect(amp);
  harmonic.connect(harmonicGain);
  harmonicGain.connect(amp);
  amp.connect(dest);

  fundamental.start(startTime);
  harmonic.start(startTime);
  fundamental.stop(startTime + dur + 0.05);
  harmonic.stop(startTime + dur + 0.05);
}

/**
 * Delicate subtle bell chime with soft airy shimmer.
 */
function triggerDelicateBell(
  ctx: BaseAudioContext,
  dest: AudioNode,
  freq: number,
  startTime: number,
  dur: number,
  gainAmount: number
) {
  if (startTime < 0) return;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const amp = ctx.createGain();

  osc1.type = "sine";
  osc1.frequency.setValueAtTime(freq, startTime);

  osc2.type = "sine";
  osc2.frequency.setValueAtTime(freq * 2.002, startTime);

  const overGain = ctx.createGain();
  overGain.gain.value = 0.2;

  amp.gain.setValueAtTime(0.0001, startTime);
  amp.gain.linearRampToValueAtTime(gainAmount, startTime + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

  osc1.connect(amp);
  osc2.connect(overGain);
  overGain.connect(amp);
  amp.connect(dest);

  osc1.start(startTime);
  osc2.start(startTime);
  osc1.stop(startTime + dur + 0.06);
  osc2.stop(startTime + dur + 0.06);
}

/**
 * Sound effects specifically for The Little Dot (Pencil & Eraser):
 * - pencil-tap: soft crisp graphite tip tapping onto warm ivory paper
 * - eraser-slide: matte rubber eraser friction sliding across textured drawing paper
 * - graphite-scratch: delicate graphite pencil line scratching/gliding on paper
 * - flower-bloom: gentle musical shimmer at flower reveal
 */
function triggerPaperFoley(
  ctx: BaseAudioContext,
  dest: AudioNode,
  kind: "pencil-tap" | "eraser-slide" | "graphite-scratch" | "flower-bloom",
  startTime: number,
  dur = 0.25
) {
  if (kind === "pencil-tap") {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(520, startTime);
    osc.frequency.exponentialRampToValueAtTime(210, startTime + 0.045);
    amp.gain.setValueAtTime(0.0001, startTime);
    amp.gain.linearRampToValueAtTime(0.11, startTime + 0.003);
    amp.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.075);
    osc.connect(amp);
    amp.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + 0.09);
  } else if (kind === "eraser-slide") {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = Math.sin((i / len) * Math.PI);
      ch[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(640, startTime);
    bp.frequency.linearRampToValueAtTime(480, startTime + dur);
    bp.Q.value = 1.9;
    const amp = ctx.createGain();
    amp.gain.value = 0.075;
    src.connect(bp);
    bp.connect(amp);
    amp.connect(dest);
    src.start(startTime);
  } else if (kind === "graphite-scratch") {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = Math.sin((i / len) * Math.PI);
      ch[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(2450, startTime);
    bp.Q.value = 2.8;
    const amp = ctx.createGain();
    amp.gain.value = 0.044;
    src.connect(bp);
    bp.connect(amp);
    amp.connect(dest);
    src.start(startTime);
  } else {
    triggerDelicateBell(ctx, dest, 1046.5, startTime, 1.8, 0.075);
  }
}

const C4 = 261.63;
const D4 = 293.66;
const E4 = 329.63;
const G4 = 392.0;
const C5 = 523.25;
const C6 = 1046.5;

/**
 * Background Music 1 — Curiosity (0–15 seconds)
 * - Simple four-note melody: C4, E4, D4, G4
 * - Soft piano & subtle pizzicato ONLY
 * - Begins ~90 BPM (Beat 1), repeats with rhythmic variations,
 *   synchronizes notes with pencil dot taps, accelerates to ~120 BPM during chase (Beat 2).
 */
function scheduleTrack1(
  ctx: BaseAudioContext,
  dest: AudioNode,
  seed: number
) {
  const altRhythm = seed % 2 === 0;

  // --- Beat 1 (0–7s): ~90 BPM (beat = 0.667s), short, light, playful notes ---
  // Phrase 1: C4 -> E4 -> G4 (syncs with 1st pencil dot tap at 1.45s!) -> D4
  const beat1Cues: Array<{
    t: number;
    hz: number;
    kind: "piano" | "pizz";
    dur: number;
    gain: number;
  }> = [
    { t: 0.35, hz: C4, kind: "piano", dur: 0.55, gain: 0.16 },
    { t: 1.02, hz: E4, kind: "piano", dur: 0.42, gain: 0.15 },
    // Synced directly with Pencil's first graphite dot placement at 1.45s
    { t: 1.45, hz: G4, kind: "piano", dur: 0.48, gain: 0.19 },
    { t: 1.45, hz: G4, kind: "pizz", dur: 0.24, gain: 0.10 },
    { t: 2.12, hz: D4, kind: "piano", dur: 0.52, gain: 0.15 },
    { t: 2.48, hz: E4, kind: "pizz", dur: 0.22, gain: 0.095 },

    // Phrase 2 (small rhythmic variation as Eraser slides in ~2.1–4.3s)
    { t: 3.05, hz: C4, kind: "pizz", dur: 0.24, gain: 0.11 },
    { t: 3.38, hz: E4, kind: "pizz", dur: 0.24, gain: 0.11 },
    { t: altRhythm ? 3.85 : 3.72, hz: D4, kind: "piano", dur: 0.48, gain: 0.15 },
    { t: 4.38, hz: G4, kind: "piano", dur: 0.55, gain: 0.165 },
    { t: 5.05, hz: E4, kind: "pizz", dur: 0.24, gain: 0.10 },
    { t: 5.38, hz: D4, kind: "pizz", dur: 0.24, gain: 0.10 },
    { t: 5.75, hz: C4, kind: "piano", dur: 0.58, gain: 0.155 },
    { t: 6.42, hz: D4, kind: "pizz", dur: 0.24, gain: 0.105 },
    { t: 6.75, hz: G4, kind: "pizz", dur: 0.24, gain: 0.105 },
  ];

  beat1Cues.forEach((n) => {
    if (n.kind === "piano") {
      triggerFeltPiano(ctx, dest, n.hz, n.t, n.dur, n.gain);
    } else {
      triggerPizzicato(ctx, dest, n.hz, n.t, n.gain);
    }
  });

  // --- Beat 2 (7–15s): Gradually accelerate ~90 BPM -> ~120 BPM during the chase ---
  // All 11 Beat-2 Pencil dot tap timestamps get a crisp short piano note from [C4, E4, D4, G4]
  const beat2TapNotes: Array<[number, number]> = [
    [7.60, C4],
    [8.02, E4],
    [8.82, D4],
    [9.58, G4],
    [10.30, C4],
    [10.98, E4],
    [11.62, D4],
    [12.26, G4],
    [12.92, C4],
    [13.62, E4],
    [14.44, G4],
  ];

  beat2TapNotes.forEach(([t, hz]) => {
    triggerFeltPiano(ctx, dest, hz, t, 0.34, 0.185);
    triggerPizzicato(ctx, dest, hz, t, 0.085);
  });

  // Subtle pizzicato chase steps accelerating from ~90 BPM (0.67s) to ~120 BPM (0.25s eighth pulses)
  const chasePizz: Array<[number, number, number]> = [
    [7.15, G4, 0.105],
    [7.82, D4, 0.095],
    [8.42, C4, 0.105],
    [9.20, E4, 0.105],
    [9.94, D4, 0.11],
    [10.64, G4, 0.11],
    [11.30, C4, 0.115],
    [11.94, E4, 0.115],
    [12.58, D4, 0.115],
    [13.26, G4, 0.12],
    [13.88, D4, 0.115],
    [14.16, C4, 0.11],
    [14.70, D4, 0.10],
    [14.96, E4, 0.085],
  ];

  chasePizz.forEach(([t, hz, gain], idx) => {
    const pick = altRhythm && idx % 3 === 1 ? (hz === D4 ? E4 : D4) : hz;
    triggerPizzicato(ctx, dest, pick, t, gain);
  });
}

/**
 * Background Music 2 — Blooming (15–30 seconds)
 * - Simple ascending melody: C4, E4, G4, C5
 * - Soft piano, gentle xylophone & subtle bell sounds ONLY
 * - Relaxed ~75 BPM (beat = 0.80s) with longer resonant notes
 * - Ascending notes track pencil connecting dots (15.05–19.6s)
 * - Gentle musical accent when Eraser's eyes widen in surprise (~18.1s)
 * - Delicate high note when completed flower is revealed (~19.35s)
 * - Slows down gently during apology & reconciliation (23–30s), ending with sustained final note.
 */
function scheduleTrack2(
  ctx: BaseAudioContext,
  dest: AudioNode,
  seed: number,
  timeOffset = 0
) {
  const shift = (t: number) => t + timeOffset;
  const alt = seed % 2 === 0;

  // --- Beat 3 (15–23s): Ascending C4 -> E4 -> G4 -> C5 as dots connect into the flower ---
  // 15.05s: Stem starts
  triggerFeltPiano(ctx, dest, C4, shift(15.05), 2.2, 0.175);
  triggerGentleXylophone(ctx, dest, C4, shift(15.05), 0.9, 0.095);

  // 15.85s: Left leaf
  triggerFeltPiano(ctx, dest, E4, shift(15.85), 2.0, 0.17);
  triggerGentleXylophone(ctx, dest, E4, shift(15.85), 0.9, 0.095);

  // 16.45s: Right leaf
  triggerFeltPiano(ctx, dest, G4, shift(16.55), 2.0, 0.175);
  triggerGentleXylophone(ctx, dest, G4, shift(16.55), 0.95, 0.10);

  // 17.30s: Lower petals connecting
  triggerFeltPiano(ctx, dest, C5, shift(17.30), 2.1, 0.18);
  triggerGentleXylophone(ctx, dest, C5, shift(17.30), 1.0, 0.10);

  // 18.10s: Gentle musical accent synchronized with Eraser's eyes widening in surprise
  triggerFeltPiano(ctx, dest, G4, shift(18.10), 1.8, 0.14);
  triggerFeltPiano(ctx, dest, C5, shift(18.10), 1.9, 0.17);
  triggerDelicateBell(ctx, dest, C5, shift(18.10), 1.6, 0.075);

  // 19.35s: Completed flower revealed -> delicate high note with soft piano resonance
  triggerDelicateBell(ctx, dest, C6, shift(19.35), 2.5, 0.095);
  triggerGentleXylophone(ctx, dest, C5, shift(19.35), 1.4, 0.11);
  triggerFeltPiano(ctx, dest, C4, shift(19.35), 2.8, 0.125);
  triggerFeltPiano(ctx, dest, E4, shift(19.35), 2.8, 0.11);
  triggerFeltPiano(ctx, dest, G4, shift(19.35), 2.8, 0.115);

  // 20.6–22.8s: Warm relaxed 75 BPM phrase (0.80s spacing)
  triggerGentleXylophone(ctx, dest, alt ? E4 : G4, shift(20.65), 1.1, 0.095);
  triggerFeltPiano(ctx, dest, E4, shift(21.45), 1.7, 0.155);
  triggerFeltPiano(ctx, dest, C4, shift(22.25), 1.8, 0.155);

  // --- Beat 4 (23–30s): Apology & reconciliation with gentle ritardando (75 -> ~50 BPM) ---
  // 23.10s: Eraser glides to clear stray marks
  triggerFeltPiano(ctx, dest, C4, shift(23.10), 1.9, 0.155);
  triggerGentleXylophone(ctx, dest, C4, shift(23.10), 1.0, 0.085);

  // 23.95s: Soft E4 (0.85s interval)
  triggerFeltPiano(ctx, dest, E4, shift(23.95), 1.9, 0.155);
  triggerGentleXylophone(ctx, dest, E4, shift(23.95), 1.0, 0.085);

  // 24.90s: Soft G4 (0.95s interval) as Pencil adds final detail
  triggerFeltPiano(ctx, dest, G4, shift(24.90), 2.1, 0.16);
  triggerDelicateBell(ctx, dest, G4, shift(24.90), 1.6, 0.055);

  // 25.95s: Slower E4 (1.05s interval) during Eraser apology tilt ("I'm so sorry. Can you forgive me?")
  triggerFeltPiano(ctx, dest, E4, shift(25.95), 2.1, 0.15);

  // 27.05s: Slower G4 (1.10s interval) as Pencil responds ("No worries!")
  triggerFeltPiano(ctx, dest, G4, shift(27.05), 1.9, 0.15);
  triggerGentleXylophone(ctx, dest, G4, shift(27.05), 1.2, 0.08);

  // 28.05s: Gentle, sustained final note (C5 + warm C4/E4/G4 open resonance fading smoothly before 30s)
  triggerFeltPiano(ctx, dest, C4, shift(28.05), 1.9, 0.125);
  triggerFeltPiano(ctx, dest, E4, shift(28.05), 1.9, 0.105);
  triggerFeltPiano(ctx, dest, G4, shift(28.05), 1.9, 0.105);
  triggerFeltPiano(ctx, dest, C5, shift(28.05), 1.9, 0.165);
  triggerDelicateBell(ctx, dest, C6, shift(28.05), 1.9, 0.06);
}

function scheduleFoley(ctx: BaseAudioContext, foleyBus: AudioNode) {
  // Beat 1: soft pencil tap placing the first graphite dot + rubber friction as eraser enters
  triggerPaperFoley(ctx, foleyBus, "pencil-tap", 1.45);
  triggerPaperFoley(ctx, foleyBus, "eraser-slide", 3.1, 0.32);

  // Beat 2: rhythmic graphite tapping sounds synchronized with Beat 2 dots & notes + eraser chase friction
  const beat2TapTimes = [
    7.60, 8.02, 8.82, 9.58, 10.30, 10.98, 11.62, 12.26, 12.92, 13.62, 14.44,
  ];
  beat2TapTimes.forEach((t) => triggerPaperFoley(ctx, foleyBus, "pencil-tap", t));
  [7.85, 9.4, 11.1, 12.75, 14.2].forEach((t) =>
    triggerPaperFoley(ctx, foleyBus, "eraser-slide", t, 0.28)
  );

  // Beat 3: soft graphite scratching as dots are connected + flower reveal accent at 19.35s
  triggerPaperFoley(ctx, foleyBus, "graphite-scratch", 15.1, 1.15);
  triggerPaperFoley(ctx, foleyBus, "graphite-scratch", 16.4, 1.15);
  triggerPaperFoley(ctx, foleyBus, "graphite-scratch", 17.65, 0.95);
  triggerPaperFoley(ctx, foleyBus, "flower-bloom", 19.35);

  // Beat 4: gentle erasing of unnecessary marks + soft final graphite detail
  triggerPaperFoley(ctx, foleyBus, "eraser-slide", 23.85, 0.42);
  triggerPaperFoley(ctx, foleyBus, "graphite-scratch", 25.35, 0.55);
}

/**
 * Generates both minimalist background music tracks (Curiosity 0–15s & Blooming 15–30s)
 * plus a unified 30.00-second stereo mix with smooth 15s crossfade and synchronized foley.
 */
export async function generateOriginalSoundtrack(
  seed = 1,
  sampleRate = 48000
): Promise<{
  combinedBuffer: AudioBuffer;
  track1Buffer: AudioBuffer;
  track2Buffer: AudioBuffer;
}> {
  const durationSec = 30;

  // 1. Standalone Background Music 1 — Curiosity (0–15s active, smooth fade out 14.4–16.0s)
  const offlineT1 = new OfflineAudioContext(2, 16 * sampleRate, sampleRate);
  const t1Wet = offlineT1.createGain();
  t1Wet.gain.value = 0.26;
  const t1Conv = offlineT1.createConvolver();
  t1Conv.buffer = createWarmRoomImpulse(offlineT1, 1.4, 2.8);
  t1Wet.connect(t1Conv);
  t1Conv.connect(offlineT1.destination);

  const t1Bus = offlineT1.createGain();
  t1Bus.gain.setValueAtTime(0.001, 0);
  t1Bus.gain.linearRampToValueAtTime(0.92, 0.3);
  t1Bus.gain.setValueAtTime(0.92, 14.35);
  t1Bus.gain.linearRampToValueAtTime(0.0001, 15.95);
  t1Bus.connect(offlineT1.destination);
  t1Bus.connect(t1Wet);

  scheduleTrack1(offlineT1, t1Bus, seed);
  const track1Buffer = await offlineT1.startRendering();

  // 2. Standalone Background Music 2 — Blooming (15–30s shifted to 0–15.5s preview)
  const offlineT2 = new OfflineAudioContext(2, 15.5 * sampleRate, sampleRate);
  const t2Wet = offlineT2.createGain();
  t2Wet.gain.value = 0.34;
  const t2Conv = offlineT2.createConvolver();
  t2Conv.buffer = createWarmRoomImpulse(offlineT2, 1.8, 2.5);
  t2Wet.connect(t2Conv);
  t2Conv.connect(offlineT2.destination);

  const t2Bus = offlineT2.createGain();
  t2Bus.gain.setValueAtTime(0.001, 0);
  t2Bus.gain.linearRampToValueAtTime(0.92, 0.55);
  t2Bus.gain.setValueAtTime(0.92, 13.6);
  t2Bus.gain.linearRampToValueAtTime(0.0001, 15.42);
  t2Bus.connect(offlineT2.destination);
  t2Bus.connect(t2Wet);

  scheduleTrack2(offlineT2, t2Bus, seed, -14.8);
  const track2Buffer = await offlineT2.startRendering();

  // 3. Combined 30.00-second Score with Smooth 15s Crossfade + Synchronized Paper/Pencil/Eraser Foley
  const offline = new OfflineAudioContext(2, durationSec * sampleRate, sampleRate);

  const dryBus = offline.createGain();
  dryBus.gain.value = 0.82;
  dryBus.connect(offline.destination);

  const wetBus = offline.createGain();
  wetBus.gain.value = 0.32;
  const convolver = offline.createConvolver();
  convolver.buffer = createWarmRoomImpulse(offline, 1.7, 2.6);
  wetBus.connect(convolver);
  convolver.connect(offline.destination);

  // Track 1 (Curiosity) smooth crossfade out across 14.35s -> 15.85s
  const track1Bus = offline.createGain();
  track1Bus.gain.setValueAtTime(0.001, 0);
  track1Bus.gain.linearRampToValueAtTime(0.92, 0.3);
  track1Bus.gain.setValueAtTime(0.92, 14.35);
  track1Bus.gain.linearRampToValueAtTime(0.0001, 15.85);
  track1Bus.connect(dryBus);
  track1Bus.connect(wetBus);

  // Track 2 (Blooming) smooth crossfade in across 14.35s -> 15.65s & sustained fade at 30s
  const track2Bus = offline.createGain();
  track2Bus.gain.setValueAtTime(0.0001, 0);
  track2Bus.gain.setValueAtTime(0.0001, 14.35);
  track2Bus.gain.linearRampToValueAtTime(0.94, 15.55);
  track2Bus.gain.setValueAtTime(0.94, 28.4);
  track2Bus.gain.linearRampToValueAtTime(0.0001, 29.95);
  track2Bus.connect(dryBus);
  track2Bus.connect(wetBus);

  const foleyBus = offline.createGain();
  foleyBus.gain.value = 0.72;
  foleyBus.connect(dryBus);

  scheduleTrack1(offline, track1Bus, seed);
  scheduleTrack2(offline, track2Bus, seed, 0);
  scheduleFoley(offline, foleyBus);

  const combinedBuffer = await offline.startRendering();
  return { combinedBuffer, track1Buffer, track2Buffer };
}

/**
 * Schedules automatic volume ducking on a GainNode whenever characters speak
 * so the background music always remains clearly audible yet quieter than dialogue.
 */
export function buildDuckingEnvelope(
  gainNode: AudioParam,
  baseVolume: number,
  timedLines: TimedLine[],
  startTimeInCtx: number,
  offsetSec: number
) {
  const ducked = baseVolume * 0.42; // Keep music gently audible beneath English voices
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
