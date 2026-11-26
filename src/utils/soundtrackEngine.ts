import { DEFAULT_TIMELINE_MARKERS } from "../data/defaults";
import type { MasterTimelineMarkers, TimedLine } from "../types";

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
 * Background Music 1 — Curiosity (Beat 1 + Beat 2 -> until Beat 3 Turn)
 * - Simple four-note melody: C4, E4, D4, G4
 * - Soft piano & subtle pizzicato ONLY
 * - Synchronized directly with Pencil dot taps and Beat 2 chase tempo.
 */
function scheduleTrack1(
  ctx: BaseAudioContext,
  dest: AudioNode,
  seed: number,
  markers: MasterTimelineMarkers
) {
  const altRhythm = seed % 2 === 0;
  const tap1 = markers.dot1TapSec;
  const b2Start = markers.beat2StartSec;
  const b3Start = markers.beat3StartSec;

  // --- Beat 1: ~90 BPM playful notes anchored around dot1TapSec & Eraser arrival ---
  const beat1Cues: Array<{
    t: number;
    hz: number;
    kind: "piano" | "pizz";
    dur: number;
    gain: number;
  }> = [
    { t: Math.max(0.15, tap1 - 0.65), hz: C4, kind: "piano", dur: 0.55, gain: 0.16 },
    { t: Math.max(0.45, tap1 - 0.32), hz: E4, kind: "piano", dur: 0.42, gain: 0.15 },
    { t: tap1, hz: G4, kind: "piano", dur: 0.48, gain: 0.19 },
    { t: tap1, hz: G4, kind: "pizz", dur: 0.24, gain: 0.10 },
    { t: tap1 + 0.55, hz: D4, kind: "piano", dur: 0.52, gain: 0.15 },
    { t: tap1 + 0.9, hz: E4, kind: "pizz", dur: 0.22, gain: 0.095 },
  ];

  // Fill Beat 1 phrases smoothly up to b2Start using C4, E4, D4, G4
  const b1Motif = [C4, E4, D4, G4, E4, D4, C4, G4];
  let cursor = tap1 + 1.5;
  let stepIdx = 0;
  while (cursor < b2Start - 0.25) {
    const hz = b1Motif[stepIdx % b1Motif.length];
    const kind = stepIdx % 3 === 1 ? "piano" : "pizz";
    const step = altRhythm && stepIdx % 2 === 1 ? 0.58 : 0.66;
    beat1Cues.push({
      t: cursor,
      hz,
      kind,
      dur: kind === "piano" ? 0.52 : 0.24,
      gain: kind === "piano" ? 0.155 : 0.105,
    });
    cursor += step;
    stepIdx++;
  }

  beat1Cues.forEach((n) => {
    if (n.kind === "piano") {
      triggerFeltPiano(ctx, dest, n.hz, n.t, n.dur, n.gain);
    } else {
      triggerPizzicato(ctx, dest, n.hz, n.t, n.gain);
    }
  });

  // --- Beat 2: All 11 Pencil dot tap timestamps get a crisp note from [C4, E4, D4, G4] ---
  const noteCycle = [C4, E4, D4, G4];
  const tapTimes = markers.beat2DotTimes;
  tapTimes.forEach((t, idx) => {
    const hz = noteCycle[idx % noteCycle.length];
    triggerFeltPiano(ctx, dest, hz, t, 0.34, 0.185);
    triggerPizzicato(ctx, dest, hz, t, 0.085);
  });

  // Subtle pizzicato chase pulses accelerating smoothly from ~90 BPM to ~120 BPM across [b2Start, b3Start]
  const chaseSpan = Math.max(1.5, b3Start - b2Start);
  let chaseT = b2Start + 0.08;
  let cIdx = 0;
  while (chaseT < b3Start - 0.08) {
    const progress = Math.min(1, (chaseT - b2Start) / chaseSpan);
    const interval = 0.64 - progress * 0.28; // 94 BPM -> 166 BPM eighth feel (~120 BPM)
    const hz = noteCycle[(cIdx + (altRhythm ? 1 : 0)) % noteCycle.length];
    triggerPizzicato(ctx, dest, hz, chaseT, 0.095 + progress * 0.025);
    chaseT += Math.max(0.24, interval);
    cIdx++;
  }
}

/**
 * Background Music 2 — Blooming (Beat 3 Turn -> End at 30s)
 * - Simple ascending melody: C4, E4, G4, C5
 * - Soft piano, gentle xylophone & subtle bell sounds ONLY
 * - Synced directly to Beat 3 dot-connecting, Eraser eye-widen, flower reveal & Beat 4 apology.
 */
function scheduleTrack2(
  ctx: BaseAudioContext,
  dest: AudioNode,
  seed: number,
  markers: MasterTimelineMarkers,
  timeOffset = 0
) {
  const shift = (t: number) => t + timeOffset;
  const alt = seed % 2 === 0;
  const b3 = markers.beat3StartSec;
  const amazed = markers.eraserAmazedSec;
  const reveal = markers.flowerRevealPeakSec;
  const b4 = markers.beat4StartSec;
  const apology = markers.apologyStartSec;
  const reply = markers.pencilRespondSec;

  const connectSpan = Math.max(1.2, amazed - b3);
  const step0 = b3 + 0.05;
  const step1 = b3 + connectSpan * 0.34;
  const step2 = b3 + connectSpan * 0.68;

  // --- Beat 3: Ascending C4 -> E4 -> G4 -> C5 as dots connect into the flower ---
  triggerFeltPiano(ctx, dest, C4, shift(step0), 2.1, 0.175);
  triggerGentleXylophone(ctx, dest, C4, shift(step0), 0.9, 0.095);

  triggerFeltPiano(ctx, dest, E4, shift(step1), 1.9, 0.17);
  triggerGentleXylophone(ctx, dest, E4, shift(step1), 0.9, 0.095);

  triggerFeltPiano(ctx, dest, G4, shift(step2), 1.9, 0.175);
  triggerGentleXylophone(ctx, dest, G4, shift(step2), 0.95, 0.1);

  // Gentle musical accent synchronized with Eraser's eyes widening in surprise
  triggerFeltPiano(ctx, dest, G4, shift(amazed), 1.8, 0.14);
  triggerFeltPiano(ctx, dest, C5, shift(amazed), 1.9, 0.17);
  triggerDelicateBell(ctx, dest, C5, shift(amazed), 1.6, 0.075);

  // Completed flower revealed -> delicate high note with soft piano resonance
  triggerDelicateBell(ctx, dest, C6, shift(reveal), 2.5, 0.095);
  triggerGentleXylophone(ctx, dest, C5, shift(reveal), 1.4, 0.11);
  triggerFeltPiano(ctx, dest, C4, shift(reveal), 2.6, 0.125);
  triggerFeltPiano(ctx, dest, E4, shift(reveal), 2.6, 0.11);
  triggerFeltPiano(ctx, dest, G4, shift(reveal), 2.6, 0.115);

  // Warm relaxed ~75 BPM phrases through end of Beat 3
  let tWarm = reveal + 0.95;
  const warmCycle = [alt ? E4 : G4, E4, C4];
  let wIdx = 0;
  while (tWarm < b4 - 0.15) {
    const hz = warmCycle[wIdx % warmCycle.length];
    triggerFeltPiano(ctx, dest, hz, shift(tWarm), 1.65, 0.15);
    if (wIdx % 2 === 0) {
      triggerGentleXylophone(ctx, dest, hz, shift(tWarm), 1.0, 0.09);
    }
    tWarm += 0.8;
    wIdx++;
  }

  // --- Beat 4: Apology & reconciliation with gentle ritardando (75 -> ~50 BPM) ---
  triggerFeltPiano(ctx, dest, C4, shift(b4 + 0.08), 1.8, 0.155);
  triggerGentleXylophone(ctx, dest, C4, shift(b4 + 0.08), 1.0, 0.085);

  if (apology > b4 + 0.7) {
    triggerFeltPiano(ctx, dest, E4, shift((b4 + apology) * 0.5), 1.8, 0.15);
  }

  // Soft E4 right as Eraser begins apologizing ("I'm so sorry. Can you forgive me?")
  triggerFeltPiano(ctx, dest, E4, shift(apology), 2.0, 0.15);
  triggerDelicateBell(ctx, dest, G4, shift(apology), 1.5, 0.05);

  // Warm G4 right as Pencil responds ("No worries! Let's make something beautiful together.")
  triggerFeltPiano(ctx, dest, G4, shift(reply), 2.0, 0.155);
  triggerGentleXylophone(ctx, dest, G4, shift(reply), 1.2, 0.085);

  // Gentle, sustained final note ending cleanly before 30.0s
  const finalChordT = Math.min(28.25, Math.max(reply + 1.25, markers.pencilRespondEndSec - 0.15));
  const finalDur = Math.max(1.4, 29.85 - finalChordT);
  triggerFeltPiano(ctx, dest, C4, shift(finalChordT), finalDur, 0.125);
  triggerFeltPiano(ctx, dest, E4, shift(finalChordT), finalDur, 0.105);
  triggerFeltPiano(ctx, dest, G4, shift(finalChordT), finalDur, 0.105);
  triggerFeltPiano(ctx, dest, C5, shift(finalChordT), finalDur, 0.165);
  triggerDelicateBell(ctx, dest, C6, shift(finalChordT), finalDur, 0.06);
}

function scheduleFoley(
  ctx: BaseAudioContext,
  foleyBus: AudioNode,
  markers: MasterTimelineMarkers
) {
  // Beat 1: soft pencil tap placing 1st dot + rubber friction as eraser slides in
  triggerPaperFoley(ctx, foleyBus, "pencil-tap", markers.dot1TapSec);
  triggerPaperFoley(ctx, foleyBus, "eraser-slide", markers.eraserArriveStartSec + 0.18, 0.34);

  // Beat 2: rhythmic graphite tapping sounds synchronized with all 11 dots + eraser chase friction
  markers.beat2DotTimes.forEach((t) =>
    triggerPaperFoley(ctx, foleyBus, "pencil-tap", t)
  );
  const chaseSpan = Math.max(1.2, markers.beat3StartSec - markers.beat2StartSec);
  for (let i = 0; i < 4; i++) {
    const et = markers.beat2StartSec + 0.3 + (i / 4) * (chaseSpan - 0.45);
    triggerPaperFoley(ctx, foleyBus, "eraser-slide", et, 0.28);
  }

  // Beat 3: soft graphite scratching as dots connect + flower reveal chime
  const b3 = markers.beat3StartSec;
  const peak = markers.flowerRevealPeakSec;
  triggerPaperFoley(ctx, foleyBus, "graphite-scratch", b3 + 0.05, Math.min(1.15, (peak - b3) * 0.45));
  triggerPaperFoley(ctx, foleyBus, "graphite-scratch", b3 + (peak - b3) * 0.48, Math.min(1.1, (peak - b3) * 0.45));
  triggerPaperFoley(ctx, foleyBus, "flower-bloom", peak);

  // Beat 4: gentle erasing of stray marks + soft final detail
  triggerPaperFoley(
    ctx,
    foleyBus,
    "eraser-slide",
    markers.beat4StartSec + 0.2,
    Math.max(0.28, Math.min(0.55, markers.apologyStartSec - markers.beat4StartSec - 0.25))
  );
  triggerPaperFoley(
    ctx,
    foleyBus,
    "graphite-scratch",
    Math.min(28.5, markers.apologyEndSec + 0.15),
    0.5
  );
}

/**
 * Generates both minimalist background music tracks (Curiosity & Blooming)
 * plus a unified 30.00-second stereo mix locked to MasterTimelineMarkers.
 */
export async function generateOriginalSoundtrack(
  seed = 1,
  sampleRate = 48000,
  markers: MasterTimelineMarkers = DEFAULT_TIMELINE_MARKERS
): Promise<{
  combinedBuffer: AudioBuffer;
  track1Buffer: AudioBuffer;
  track2Buffer: AudioBuffer;
}> {
  const durationSec = 30;
  const xfadeCenter = markers.beat3StartSec;
  const xfadeStart = Math.max(4.0, xfadeCenter - 0.55);
  const xfadeEnd = Math.min(24.0, xfadeCenter + 0.65);

  // 1. Standalone Background Music 1 — Curiosity
  const t1LenSec = Math.max(10, Math.ceil(xfadeEnd + 0.5));
  const offlineT1 = new OfflineAudioContext(2, t1LenSec * sampleRate, sampleRate);
  const t1Wet = offlineT1.createGain();
  t1Wet.gain.value = 0.26;
  const t1Conv = offlineT1.createConvolver();
  t1Conv.buffer = createWarmRoomImpulse(offlineT1, 1.4, 2.8);
  t1Wet.connect(t1Conv);
  t1Conv.connect(offlineT1.destination);

  const t1Bus = offlineT1.createGain();
  t1Bus.gain.setValueAtTime(0.001, 0);
  t1Bus.gain.linearRampToValueAtTime(0.92, 0.3);
  t1Bus.gain.setValueAtTime(0.92, xfadeStart);
  t1Bus.gain.linearRampToValueAtTime(0.0001, xfadeEnd);
  t1Bus.connect(offlineT1.destination);
  t1Bus.connect(t1Wet);

  scheduleTrack1(offlineT1, t1Bus, seed, markers);
  const track1Buffer = await offlineT1.startRendering();

  // 2. Standalone Background Music 2 — Blooming (shifted to start at 0 for standalone preview)
  const t2PreviewStart = xfadeStart;
  const t2LenSec = Math.max(8, Math.ceil(30 - t2PreviewStart + 0.5));
  const offlineT2 = new OfflineAudioContext(2, t2LenSec * sampleRate, sampleRate);
  const t2Wet = offlineT2.createGain();
  t2Wet.gain.value = 0.34;
  const t2Conv = offlineT2.createConvolver();
  t2Conv.buffer = createWarmRoomImpulse(offlineT2, 1.8, 2.5);
  t2Wet.connect(t2Conv);
  t2Conv.connect(offlineT2.destination);

  const t2Bus = offlineT2.createGain();
  t2Bus.gain.setValueAtTime(0.001, 0);
  t2Bus.gain.linearRampToValueAtTime(0.92, 0.55);
  t2Bus.gain.setValueAtTime(0.92, Math.max(1.0, 28.4 - t2PreviewStart));
  t2Bus.gain.linearRampToValueAtTime(0.0001, Math.max(1.5, 29.92 - t2PreviewStart));
  t2Bus.connect(offlineT2.destination);
  t2Bus.connect(t2Wet);

  scheduleTrack2(offlineT2, t2Bus, seed, markers, -t2PreviewStart);
  const track2Buffer = await offlineT2.startRendering();

  // 3. Combined 30.00-second Score with Smooth Crossfade at beat3StartSec + Synchronized Foley
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

  const track1Bus = offline.createGain();
  track1Bus.gain.setValueAtTime(0.001, 0);
  track1Bus.gain.linearRampToValueAtTime(0.92, 0.3);
  track1Bus.gain.setValueAtTime(0.92, xfadeStart);
  track1Bus.gain.linearRampToValueAtTime(0.0001, xfadeEnd);
  track1Bus.connect(dryBus);
  track1Bus.connect(wetBus);

  const track2Bus = offline.createGain();
  track2Bus.gain.setValueAtTime(0.0001, 0);
  track2Bus.gain.setValueAtTime(0.0001, xfadeStart);
  track2Bus.gain.linearRampToValueAtTime(0.94, xfadeEnd);
  track2Bus.gain.setValueAtTime(0.94, 28.4);
  track2Bus.gain.linearRampToValueAtTime(0.0001, 29.95);
  track2Bus.connect(dryBus);
  track2Bus.connect(wetBus);

  const foleyBus = offline.createGain();
  foleyBus.gain.value = 0.72;
  foleyBus.connect(dryBus);

  scheduleTrack1(offline, track1Bus, seed, markers);
  scheduleTrack2(offline, track2Bus, seed, markers, 0);
  scheduleFoley(offline, foleyBus, markers);

  const combinedBuffer = await offline.startRendering();
  return { combinedBuffer, track1Buffer, track2Buffer };
}

/**
 * Schedules automatic volume ducking on a GainNode whenever characters speak
 * so background music stays gently audible beneath English voices.
 */
export function buildDuckingEnvelope(
  gainNode: AudioParam,
  baseVolume: number,
  timedLines: TimedLine[],
  startTimeInCtx: number,
  offsetSec: number
) {
  const ducked = baseVolume * 0.42;
  const fade = 0.16;

  gainNode.cancelScheduledValues(startTimeInCtx);
  const currentlySpeaking = timedLines.some(
    (l) => offsetSec >= l.startSec - 0.08 && offsetSec <= l.endSec + 0.08
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
    gainNode.linearRampToValueAtTime(baseVolume, restoreAt + fade * 1.3);
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
