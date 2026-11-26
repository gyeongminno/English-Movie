import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import {
  FILM_CREDIT_TEXT,
  PALETTE,
  getVoiceIdForSpeaker,
  splitDialogueIntoSubtitleSegments,
  wrapSubtitleToMaxTwoLines,
} from "../data/defaults";
import type {
  AnimationStyle,
  Beat,
  GeneratedVideoPackage,
  MasterTimelineMarkers,
  SpeakerRole,
  TimedLine,
  TimedSubtitleSegment,
  WordTimestamp,
} from "../types";
import { renderFrame as render2DFallbackFrame } from "./canvasRenderer";
import {
  buildDuckingEnvelope,
  generateOriginalSoundtrack,
} from "./soundtrackEngine";
import { ThreeFilmStage } from "./threeRenderer";

export interface AlignedSegmentData {
  text: string;
  startSec: number;
  endSec: number;
  words: WordTimestamp[];
}

export interface AudioAlignmentData {
  rawDurationSec: number;
  speechOnsetSec: number;
  speechOffsetSec: number;
  segments: AlignedSegmentData[];
  method?: string;
}

function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function estimateSegmentWeight(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  let weight = 0;
  for (const w of words) {
    const syl = w.toLowerCase().match(/[aeiouy]+/g)?.length || 1;
    weight += Math.max(1, syl) * 0.65 + 0.45;
    if (/[,;:]$/.test(w)) weight += 0.6;
    if (/[!?]$/.test(w)) weight += 1.1;
    else if (/\.$/.test(w)) weight += 0.85;
  }
  return Math.max(1, weight);
}

function buildFallbackWords(
  segText: string,
  startSec: number,
  endSec: number
): WordTimestamp[] {
  const words = segText.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const weights = words.map((w) => {
    const syl = w.toLowerCase().match(/[aeiouy]+/g)?.length || 1;
    return Math.max(1, syl) * 0.65 + 0.35;
  });
  const totalW = weights.reduce((a, b) => a + b, 0) || 1;
  const span = Math.max(0.1, endSec - startSec);
  let cursor = startSec;
  return words.map((word, idx) => {
    const dur =
      idx === words.length - 1 ? endSec - cursor : span * (weights[idx] / totalW);
    const ws = cursor;
    const we = cursor + dur;
    cursor = we;
    return {
      word,
      startSec: Number(ws.toFixed(3)),
      endSec: Number(we.toFixed(3)),
    };
  });
}

function buildSyllableAlignment(
  text: string,
  totalDur: number,
  onset = 0,
  offset = totalDur
): AudioAlignmentData {
  const segTexts = splitDialogueIntoSubtitleSegments(text);
  const activeSpan = Math.max(0.3, offset - onset);
  const weights = segTexts.map(estimateSegmentWeight);
  const totalW = weights.reduce((a, b) => a + b, 0) || 1;
  let cursor = onset;
  const segments: AlignedSegmentData[] = segTexts.map((segText, idx) => {
    const dur =
      idx === segTexts.length - 1
        ? offset - cursor
        : activeSpan * (weights[idx] / totalW);
    const startSec = Number(cursor.toFixed(3));
    const endSec = Number(Math.max(startSec + 0.15, cursor + dur).toFixed(3));
    cursor = endSec;
    return {
      text: segText,
      startSec,
      endSec,
      words: buildFallbackWords(segText, startSec, endSec),
    };
  });
  return {
    rawDurationSec: totalDur,
    speechOnsetSec: onset,
    speechOffsetSec: offset,
    segments,
    method: "client-syllable-fallback",
  };
}

export async function synthesizeLineAudio(
  text: string,
  speaker: SpeakerRole,
  beatNumber: number,
  audioCtx: AudioContext
): Promise<{
  buffer: AudioBuffer | null;
  alignment?: AudioAlignmentData;
  fallbackNotice?: string;
}> {
  const voiceId = getVoiceIdForSpeaker(speaker);
  const segments = splitDialogueIntoSubtitleSegments(text);
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, speaker, voiceId, beatNumber, segments }),
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { error?: string };
    return {
      buffer: null,
      fallbackNotice:
        errBody.error ||
        "Studio voice temporarily unavailable; using browser English voices.",
    };
  }

  const data = (await res.json()) as {
    audioBase64?: string | null;
    fallback?: boolean;
    notice?: string;
    alignment?: AudioAlignmentData;
  };
  if (!data.audioBase64) {
    return {
      buffer: null,
      fallbackNotice:
        data.notice ||
        "Studio voice temporarily unavailable; using browser English voices.",
    };
  }

  const wavBuffer = decodeBase64ToArrayBuffer(data.audioBase64);
  const buffer = await audioCtx.decodeAudioData(wavBuffer);
  return {
    buffer,
    alignment:
      data.alignment ?? buildSyllableAlignment(text, buffer.duration, 0, buffer.duration),
  };
}

function splitKoreanTranslations(beat: Beat): string[] {
  const rawLines = beat.koreanMeaning
    .split("\n")
    .map((s) => s.replace(/^(지우개|연필|점|Pencil|Eraser|Dot)\s*:\s*/i, "").trim())
    .filter(Boolean);
  if (rawLines.length === beat.lines.length) {
    return rawLines;
  }
  return beat.lines.map(() => beat.koreanMeaning.trim());
}

interface RawSynthesizedLine {
  lineId: string;
  beatNumber: 1 | 2 | 3 | 4;
  speaker: SpeakerRole;
  text: string;
  koreanTranslation: string;
  buffer: AudioBuffer | null;
  alignment: AudioAlignmentData;
}

/**
 * Computes the complete, unified 30-second master timeline (MasterTimelineMarkers,
 * TimedLine[], and TimedSubtitleSegment[]) directly from actual measured speech audio.
 */
function buildMasterTimelineFromSynthesized(
  rawLines: RawSynthesizedLine[]
): {
  timedLines: TimedLine[];
  timedSegments: TimedSubtitleSegment[];
  timelineMarkers: MasterTimelineMarkers;
} {
  const byBeat = (n: 1 | 2 | 3 | 4) =>
    rawLines.filter((r) => r.beatNumber === n);

  const b1 = byBeat(1);
  const b2 = byBeat(2);
  const b3 = byBeat(3);
  const b4 = byBeat(4);

  const getActiveSpan = (r: RawSynthesizedLine) =>
    Math.max(0.45, r.alignment.speechOffsetSec - r.alignment.speechOnsetSec);

  const sumSpan = (arr: RawSynthesizedLine[]) =>
    arr.reduce((acc, r) => acc + getActiveSpan(r), 0);

  const b1Speech = sumSpan(b1);
  const b2Speech = sumSpan(b2);
  const b3Speech = sumSpan(b3);
  const b4aSpeech = b4[0] ? getActiveSpan(b4[0]) : 0;
  const b4bSpeech = b4.slice(1).reduce((acc, r) => acc + getActiveSpan(r), 0);
  const totalRawSpeech = b1Speech + b2Speech + b3Speech + b4aSpeech + b4bSpeech;

  // Ideal cinematic gaps around actual spoken audio
  let introGap = 1.6;
  let gap12 = 0.4;
  let gap23 = 0.32;
  let flowerBuildupGap = 1.85;
  let gap34 = 0.35;
  let wipeGap = 1.05;
  let turnGap4 = b4.length > 1 ? 0.45 : 0;
  let finalHold = 1.1;
  let intraLineGap = 0.2;

  const extraIntraLines =
    Math.max(0, b1.length - 1) +
    Math.max(0, b2.length - 1) +
    Math.max(0, b3.length - 1) +
    Math.max(0, b4.length - 2);

  let totalGaps =
    introGap +
    gap12 +
    gap23 +
    flowerBuildupGap +
    gap34 +
    wipeGap +
    turnGap4 +
    finalHold +
    extraIntraLines * intraLineGap;

  // If natural speech + ideal gaps > 29.85s, first gently compress non-speech gaps
  if (totalRawSpeech + totalGaps > 29.85) {
    introGap = 1.25;
    gap12 = 0.32;
    gap23 = 0.28;
    flowerBuildupGap = 1.35;
    gap34 = 0.28;
    wipeGap = 0.78;
    turnGap4 = b4.length > 1 ? 0.36 : 0;
    finalHold = 0.85;
    intraLineGap = 0.14;
    totalGaps =
      introGap +
      gap12 +
      gap23 +
      flowerBuildupGap +
      gap34 +
      wipeGap +
      turnGap4 +
      finalHold +
      extraIntraLines * intraLineGap;
  }

  const availableSpeechBudget = Math.max(10, 29.85 - totalGaps);
  const speechPlaybackRate =
    totalRawSpeech > availableSpeechBudget
      ? Math.min(1.42, totalRawSpeech / availableSpeechBudget)
      : 1.0;

  const timedLines: TimedLine[] = [];
  const timedSegments: TimedSubtitleSegment[] = [];

  const placeLine = (r: RawSynthesizedLine, startSec: number): TimedLine => {
    const trimStart = r.alignment.speechOnsetSec;
    const trimEnd = r.alignment.speechOffsetSec;
    const activeDur = Math.max(0.45, trimEnd - trimStart) / speechPlaybackRate;
    const lineStart = Number(startSec.toFixed(3));
    const lineEnd = Number(Math.min(29.85, lineStart + activeDur).toFixed(3));

    const mapRaw = (rawSec: number) => {
      const shifted = lineStart + Math.max(0, rawSec - trimStart) / speechPlaybackRate;
      return Number(Math.max(lineStart, Math.min(lineEnd, shifted)).toFixed(3));
    };

    const segs: TimedSubtitleSegment[] = r.alignment.segments.map((seg, sIdx) => {
      const segStart = sIdx === 0 ? lineStart : mapRaw(seg.startSec);
      const segEnd =
        sIdx === r.alignment.segments.length - 1
          ? lineEnd
          : Math.max(segStart + 0.12, mapRaw(seg.endSec));
      return {
        id: `${r.lineId}-seg-${sIdx}`,
        lineId: r.lineId,
        beatNumber: r.beatNumber,
        speaker: r.speaker,
        voiceId: getVoiceIdForSpeaker(r.speaker),
        text: seg.text,
        displayLines: wrapSubtitleToMaxTwoLines(seg.text),
        koreanTranslation: r.koreanTranslation,
        startSec: segStart,
        endSec: segEnd,
        words: (seg.words || []).map((w) => ({
          word: w.word,
          startSec: Math.max(segStart, Math.min(segEnd, mapRaw(w.startSec))),
          endSec: Math.max(segStart, Math.min(segEnd, mapRaw(w.endSec))),
        })),
      };
    });

    // Guarantee non-overlapping strict monotonic segment boundaries
    for (let i = 1; i < segs.length; i++) {
      if (segs[i].startSec < segs[i - 1].endSec) {
        segs[i].startSec = segs[i - 1].endSec;
      }
      if (segs[i].endSec <= segs[i].startSec) {
        segs[i].endSec = Number((segs[i].startSec + 0.15).toFixed(3));
      }
    }

    const tl: TimedLine = {
      lineId: r.lineId,
      beatNumber: r.beatNumber,
      speaker: r.speaker,
      voiceId: getVoiceIdForSpeaker(r.speaker),
      text: r.text,
      koreanTranslation: r.koreanTranslation,
      startSec: lineStart,
      endSec: segs.length > 0 ? segs[segs.length - 1].endSec : lineEnd,
      trimStartSec: trimStart,
      trimEndSec: trimEnd,
      rawDurationSec: r.alignment.rawDurationSec,
      playbackRate: Number(speechPlaybackRate.toFixed(4)),
      segments: segs,
      audioBuffer: r.buffer,
      sourceMode: r.buffer ? "gemini-tts" : "silent-timed",
    };

    timedLines.push(tl);
    timedSegments.push(...segs);
    return tl;
  };

  // --- Place Beat 1 ---
  const dot1TapSec = Number((introGap * 0.58).toFixed(3));
  const eraserArriveStartSec = Number((dot1TapSec - 0.12).toFixed(3));
  const eraserNoticeDotSec = introGap;

  let cursor = eraserNoticeDotSec;
  b1.forEach((r, idx) => {
    if (idx > 0) cursor += intraLineGap;
    const placed = placeLine(r, cursor);
    cursor = placed.endSec;
  });
  const beat1EndSec = cursor;

  // --- Place Beat 2 ---
  const beat2StartSec = Number((beat1EndSec + gap12).toFixed(3));
  cursor = beat2StartSec + 0.14;
  const beat2SpeechStartSec = cursor;
  b2.forEach((r, idx) => {
    if (idx > 0) cursor += intraLineGap;
    const placed = placeLine(r, cursor);
    cursor = placed.endSec;
  });
  const beat2SpeechEndSec = cursor;

  // --- Place Beat 3 (flower connects BEFORE Eraser exclaims "Wow! Is that a flower?") ---
  const beat3StartSec = Number((beat2SpeechEndSec + gap23).toFixed(3));

  // Distribute Beat 2's 11 rhythmic dots across [beat2StartSec + 0.12, beat3StartSec - 0.22]
  // accelerating smoothly from ~90 BPM to ~120 BPM
  const beat2DotTimes: number[] = [];
  const tapStart = beat2StartSec + 0.12;
  const tapEnd = Math.max(tapStart + 1.5, beat3StartSec - 0.22);
  let weightSum = 0;
  const tapWeights: number[] = [];
  for (let i = 0; i < 10; i++) {
    const w = 1.25 - (i / 9) * 0.45;
    tapWeights.push(w);
    weightSum += w;
  }
  let tapCursor = tapStart;
  beat2DotTimes.push(Number(tapCursor.toFixed(3)));
  for (let i = 0; i < 10; i++) {
    tapCursor += (tapEnd - tapStart) * (tapWeights[i] / weightSum);
    beat2DotTimes.push(Number(tapCursor.toFixed(3)));
  }

  const eraserAmazedSec = Number((beat3StartSec + flowerBuildupGap).toFixed(3));
  cursor = eraserAmazedSec;
  b3.forEach((r, idx) => {
    if (idx > 0) cursor += intraLineGap;
    const placed = placeLine(r, cursor);
    cursor = placed.endSec;
  });
  const beat3SpeechEndSec = cursor;
  const flowerRevealPeakSec = Number(
    Math.min(beat3SpeechEndSec - 0.35, eraserAmazedSec + 1.25).toFixed(3)
  );

  // --- Place Beat 4 ---
  const beat4StartSec = Number((beat3SpeechEndSec + gap34).toFixed(3));
  const apologyStartSec = Number((beat4StartSec + wipeGap).toFixed(3));
  cursor = apologyStartSec;
  let apologyEndSec = apologyStartSec + 1.5;
  let pencilRespondSec = apologyEndSec + turnGap4;
  let pencilRespondEndSec = pencilRespondSec + 1.8;

  if (b4.length > 0) {
    const first = placeLine(b4[0], cursor);
    apologyEndSec = first.endSec;
    cursor = apologyEndSec;
    if (b4.length > 1) {
      cursor += turnGap4;
      pencilRespondSec = Number(cursor.toFixed(3));
      b4.slice(1).forEach((r, idx) => {
        if (idx > 0) cursor += intraLineGap;
        const placed = placeLine(r, cursor);
        cursor = placed.endSec;
      });
      pencilRespondEndSec = cursor;
    } else {
      pencilRespondSec = apologyEndSec;
      pencilRespondEndSec = apologyEndSec;
    }
  }

  const creditStartSec = Number(
    Math.min(27.2, Math.max(25.6, pencilRespondEndSec - 0.25)).toFixed(3)
  );

  const timelineMarkers: MasterTimelineMarkers = {
    totalDurationSec: 30,
    dot1TapSec,
    eraserArriveStartSec,
    eraserNoticeDotSec,
    beat1EndSec,
    beat2StartSec,
    beat2SpeechStartSec,
    beat2SpeechEndSec,
    beat2DotTimes,
    beat3StartSec,
    eraserAmazedSec,
    flowerRevealPeakSec,
    beat3SpeechEndSec,
    beat4StartSec,
    apologyStartSec,
    apologyEndSec,
    pencilRespondSec,
    pencilRespondEndSec,
    creditStartSec,
  };

  return { timedLines, timedSegments, timelineMarkers };
}

/**
 * Re-computes subtitle segment and word timestamps from existing AudioBuffers
 * (e.g., if speech playback speed changes or a single beat is replaced).
 */
export function recalculateMasterTimeline(
  timedLines: TimedLine[]
): {
  timedLines: TimedLine[];
  timedSegments: TimedSubtitleSegment[];
  timelineMarkers: MasterTimelineMarkers;
} {
  const raw: RawSynthesizedLine[] = timedLines.map((l) => ({
    lineId: l.lineId,
    beatNumber: l.beatNumber,
    speaker: l.speaker,
    text: l.text,
    koreanTranslation: l.koreanTranslation,
    buffer: l.audioBuffer,
    alignment: {
      rawDurationSec: l.rawDurationSec || l.endSec - l.startSec,
      speechOnsetSec: l.trimStartSec ?? 0,
      speechOffsetSec: l.trimEndSec || l.rawDurationSec || l.endSec - l.startSec,
      segments: l.segments.map((s) => {
        const rawStart =
          l.trimStartSec + (s.startSec - l.startSec) * (l.playbackRate || 1);
        const rawEnd =
          l.trimStartSec + (s.endSec - l.startSec) * (l.playbackRate || 1);
        return {
          text: s.text,
          startSec: rawStart,
          endSec: rawEnd,
          words: s.words.map((w) => ({
            word: w.word,
            startSec:
              l.trimStartSec + (w.startSec - l.startSec) * (l.playbackRate || 1),
            endSec:
              l.trimStartSec + (w.endSec - l.startSec) * (l.playbackRate || 1),
          })),
        };
      }),
    },
  }));
  return buildMasterTimelineFromSynthesized(raw);
}

/**
 * Generates English voices for all 4 beats, measures real audio timestamps,
 * aligns subtitles + character reactions + music + foley onto one master timeline.
 */
export async function buildVideoPackage(
  beats: Beat[],
  style: AnimationStyle,
  onProgress?: (label: string, ratio: number) => void,
  musicSeed = 1,
  existingMusic?: {
    combinedBuffer: AudioBuffer;
    track1Buffer: AudioBuffer;
    track2Buffer: AudioBuffer;
    label: string;
  }
): Promise<GeneratedVideoPackage> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const audioCtx = new AudioCtx();

  const rawLines: RawSynthesizedLine[] = [];
  let ttsFailed = false;
  let ttsErrorNotice: string | undefined;

  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    const koreanChunks = splitKoreanTranslations(beat);
    onProgress?.(
      `Synthesizing & aligning ${beat.lines.map((l) => l.speaker).join(" & ")} voice for Beat ${beat.number}...`,
      (i / beats.length) * 0.78
    );

    for (let lIdx = 0; lIdx < beat.lines.length; lIdx++) {
      const line = beat.lines[lIdx];
      let buffer: AudioBuffer | null = null;
      let alignment: AudioAlignmentData | undefined;

      if (!ttsFailed) {
        try {
          const res = await synthesizeLineAudio(
            line.text,
            line.speaker,
            beat.number,
            audioCtx
          );
          buffer = res.buffer;
          alignment = res.alignment;
          if (!buffer && res.fallbackNotice) {
            ttsFailed = true;
            ttsErrorNotice = res.fallbackNotice;
          }
        } catch (err) {
          ttsFailed = true;
          ttsErrorNotice =
            err instanceof Error
              ? err.message
              : "Voice service unavailable; timed 3D motion fallback active.";
        }
      }

      const wordCount = line.text.trim().split(/\s+/).filter(Boolean).length;
      const fallbackDur = Math.max(1.3, wordCount * 0.4);
      const effectiveAlignment =
        alignment ?? buildSyllableAlignment(line.text, fallbackDur, 0, fallbackDur);

      rawLines.push({
        lineId: line.id,
        beatNumber: beat.number,
        speaker: line.speaker,
        text: line.text,
        koreanTranslation: koreanChunks[lIdx] || beat.koreanMeaning,
        buffer,
        alignment: effectiveAlignment,
      });
    }
  }

  // Strictly guarantee ONE uniform voice mode across all 4 beats (never mix Gemini + browser TTS)
  const unifiedRawLines = ttsFailed
    ? rawLines.map((r) => {
        const wordCount = r.text.trim().split(/\s+/).filter(Boolean).length;
        const fallbackDur = Math.max(1.3, wordCount * 0.4);
        return {
          ...r,
          buffer: null,
          alignment: buildSyllableAlignment(r.text, fallbackDur, 0, fallbackDur),
        };
      })
    : rawLines;

  const { timedLines, timedSegments, timelineMarkers } =
    buildMasterTimelineFromSynthesized(unifiedRawLines);

  onProgress?.("Synchronizing Track 1, Track 2 & foley to audio master timeline...", 0.88);
  const musicPack = existingMusic
    ? {
        combinedBuffer: existingMusic.combinedBuffer,
        track1Buffer: existingMusic.track1Buffer,
        track2Buffer: existingMusic.track2Buffer,
      }
    : await generateOriginalSoundtrack(musicSeed, 48000, timelineMarkers);

  await audioCtx.close().catch(() => undefined);
  onProgress?.("Ready!", 1);

  return {
    generatedAt: Date.now(),
    style,
    mode: ttsFailed ? "3d-slideshow" : "3d-animation",
    timedLines,
    timedSegments,
    timelineMarkers,
    musicBuffer: musicPack.combinedBuffer,
    track1Buffer: musicPack.track1Buffer,
    track2Buffer: musicPack.track2Buffer,
    musicSeed,
    musicSourceLabel:
      existingMusic?.label ||
      `Original Two-Track Score #${musicSeed} (Track 1 + Track 2)`,
    totalDurationSec: 30,
    ttsErrorNotice,
  };
}

/**
 * Re-synthesizes only a single beat's audio lines, merges them with existing audio,
 * and recalculates the synchronized master timeline & soundtrack.
 */
export async function rebuildSingleBeatInPackage(
  pkg: GeneratedVideoPackage,
  updatedBeat: Beat
): Promise<GeneratedVideoPackage> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const audioCtx = new AudioCtx();
  try {
    const packageUsesGemini = pkg.timedLines.every(
      (l) => l.sourceMode === "gemini-tts"
    );
    const koreanChunks = splitKoreanTranslations(updatedBeat);
    let ttsError: string | undefined;
    let allowTts = packageUsesGemini;

    const newBeatRaw: RawSynthesizedLine[] = [];
    for (let i = 0; i < updatedBeat.lines.length; i++) {
      const line = updatedBeat.lines[i];
      let buffer: AudioBuffer | null = null;
      let alignment: AudioAlignmentData | undefined;
      if (allowTts) {
        try {
          const res = await synthesizeLineAudio(
            line.text,
            line.speaker,
            updatedBeat.number,
            audioCtx
          );
          buffer = res.buffer;
          alignment = res.alignment;
          if (!buffer && res.fallbackNotice) {
            allowTts = false;
            ttsError = res.fallbackNotice;
          }
        } catch (err) {
          allowTts = false;
          ttsError = err instanceof Error ? err.message : "Voice service error.";
        }
      }
      const wordCount = line.text.trim().split(/\s+/).filter(Boolean).length;
      const fallbackDur = Math.max(1.3, wordCount * 0.4);
      newBeatRaw.push({
        lineId: line.id,
        beatNumber: updatedBeat.number,
        speaker: line.speaker,
        text: line.text,
        koreanTranslation: koreanChunks[i] || updatedBeat.koreanMeaning,
        buffer,
        alignment:
          alignment ?? buildSyllableAlignment(line.text, fallbackDur, 0, fallbackDur),
      });
    }

    const existingOtherRaw: RawSynthesizedLine[] = pkg.timedLines
      .filter((l) => l.beatNumber !== updatedBeat.number)
      .map((l) => ({
        lineId: l.lineId,
        beatNumber: l.beatNumber,
        speaker: l.speaker,
        text: l.text,
        koreanTranslation: l.koreanTranslation,
        buffer: l.audioBuffer,
        alignment: {
          rawDurationSec: l.rawDurationSec || l.endSec - l.startSec,
          speechOnsetSec: l.trimStartSec ?? 0,
          speechOffsetSec: l.trimEndSec || l.rawDurationSec || l.endSec - l.startSec,
          segments: l.segments.map((s) => ({
            text: s.text,
            startSec:
              l.trimStartSec + (s.startSec - l.startSec) * (l.playbackRate || 1),
            endSec:
              l.trimStartSec + (s.endSec - l.startSec) * (l.playbackRate || 1),
            words: s.words.map((w) => ({
              word: w.word,
              startSec:
                l.trimStartSec + (w.startSec - l.startSec) * (l.playbackRate || 1),
              endSec:
                l.trimStartSec + (w.endSec - l.startSec) * (l.playbackRate || 1),
            })),
          })),
        },
      }));

    const mergedRaw = [...existingOtherRaw, ...newBeatRaw].sort(
      (a, b) => a.beatNumber - b.beatNumber
    );
    const anySilent = mergedRaw.some((r) => !r.buffer);
    const unifiedRaw = anySilent
      ? mergedRaw.map((r) => {
          const wordCount = r.text.trim().split(/\s+/).filter(Boolean).length;
          const fallbackDur = Math.max(1.3, wordCount * 0.4);
          return {
            ...r,
            buffer: null,
            alignment: buildSyllableAlignment(r.text, fallbackDur, 0, fallbackDur),
          };
        })
      : mergedRaw;

    const { timedLines, timedSegments, timelineMarkers } =
      buildMasterTimelineFromSynthesized(unifiedRaw);

    const isCustomUploadedMusic = pkg.musicSourceLabel.startsWith("Uploaded:");
    const musicPack = isCustomUploadedMusic
      ? {
          combinedBuffer: pkg.musicBuffer,
          track1Buffer: pkg.track1Buffer,
          track2Buffer: pkg.track2Buffer,
        }
      : await generateOriginalSoundtrack(pkg.musicSeed, 48000, timelineMarkers);

    return {
      ...pkg,
      generatedAt: Date.now(),
      mode: anySilent ? "3d-slideshow" : "3d-animation",
      timedLines,
      timedSegments,
      timelineMarkers,
      musicBuffer: musicPack.combinedBuffer,
      track1Buffer: musicPack.track1Buffer,
      track2Buffer: musicPack.track2Buffer,
      ttsErrorNotice: ttsError ?? (anySilent ? pkg.ttsErrorNotice : undefined),
    };
  } finally {
    await audioCtx.close().catch(() => undefined);
  }
}

/**
 * Renders the full 30.00-second mixed stereo track (voices + ducked two-track music + foley).
 */
async function renderMixedAudioBuffer(
  pkg: GeneratedVideoPackage,
  voiceVolume: number,
  musicVolume: number,
  sampleRate = 48000
): Promise<AudioBuffer> {
  const totalSamples = 30 * sampleRate;
  const offline = new OfflineAudioContext(2, totalSamples, sampleRate);

  if (musicVolume > 0.001) {
    const musicSrc = offline.createBufferSource();
    musicSrc.buffer = pkg.musicBuffer;
    const musicGain = offline.createGain();
    buildDuckingEnvelope(
      musicGain.gain,
      musicVolume,
      pkg.timedLines,
      0,
      0
    );
    musicSrc.connect(musicGain);
    musicGain.connect(offline.destination);
    musicSrc.start(0);
    musicSrc.stop(30);
  }

  if (voiceVolume > 0.001) {
    for (const line of pkg.timedLines) {
      if (!line.audioBuffer) continue;
      const src = offline.createBufferSource();
      src.buffer = line.audioBuffer;
      const rate = line.playbackRate || 1;
      src.playbackRate.value = rate;

      const trimStart = Math.max(0, line.trimStartSec ?? 0);
      const trimEnd = Math.min(
        line.audioBuffer.duration,
        line.trimEndSec || line.audioBuffer.duration
      );
      const sourceSpan = Math.max(0.1, trimEnd - trimStart);
      const outputDur = sourceSpan / rate;

      const gain = offline.createGain();
      gain.gain.value = voiceVolume;
      src.connect(gain);
      gain.connect(offline.destination);
      src.start(line.startSec, trimStart);
      src.stop(line.startSec + outputDur);
    }
  }

  return await offline.startRendering();
}

export function getActiveSubtitleAt(
  timeSec: number,
  timedLines: TimedLine[],
  timedSegments?: TimedSubtitleSegment[]
): { lines: string[]; korean: string; speaker: SpeakerRole; segmentId?: string } | null {
  if (timedSegments && timedSegments.length > 0) {
    for (const seg of timedSegments) {
      if (timeSec >= seg.startSec && timeSec <= seg.endSec) {
        return {
          lines: seg.displayLines,
          korean: seg.koreanTranslation,
          speaker: seg.speaker,
          segmentId: seg.id,
        };
      }
    }
    return null;
  }

  for (const line of timedLines) {
    if (line.segments && line.segments.length > 0) {
      for (const seg of line.segments) {
        if (timeSec >= seg.startSec && timeSec <= seg.endSec) {
          return {
            lines: seg.displayLines,
            korean: seg.koreanTranslation,
            speaker: seg.speaker,
            segmentId: seg.id,
          };
        }
      }
    }
  }
  return null;
}

function drawBurnedSubtitlesAndCredit(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeSec: number,
  timedLines: TimedLine[],
  timedSegments: TimedSubtitleSegment[],
  timelineMarkers: MasterTimelineMarkers
) {
  const scale = width / 1280;

  // End Credit inside [creditStartSec, 30.0s] (never extending past 30.0s)
  if (timeSec >= timelineMarkers.creditStartSec) {
    const alpha = Math.max(
      0,
      Math.min(1, (timeSec - timelineMarkers.creditStartSec) / 1.1)
    );
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `500 ${Math.round(21 * scale)}px 'Outfit', 'Noto Sans KR', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = PALETTE.darkGraphite;
    ctx.fillText(FILM_CREDIT_TEXT, width / 2, Math.round(70 * scale));
    ctx.restore();
  }

  // Burned-in English Subtitles (synchronized to exact spoken audio segments)
  const activeSub = getActiveSubtitleAt(timeSec, timedLines, timedSegments);
  if (!activeSub || activeSub.lines.length === 0) return;

  ctx.save();
  ctx.font = `700 ${Math.round(33 * scale)}px 'Plus Jakarta Sans', 'Noto Sans KR', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const lineHeight = Math.round(44 * scale);
  const baseY =
    activeSub.lines.length === 2
      ? height - Math.round(92 * scale)
      : height - Math.round(60 * scale);

  activeSub.lines.slice(0, 2).forEach((text, i) => {
    const y = baseY + i * lineHeight;
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.shadowColor = "rgba(23, 23, 23, 0.45)";
    ctx.shadowBlur = 8 * scale;
    ctx.shadowOffsetY = 2 * scale;
    ctx.strokeStyle = "rgba(23, 23, 23, 0.94)";
    ctx.lineWidth = 7 * scale;
    ctx.strokeText(text, width / 2, y);

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(text, width / 2, y);
  });
  ctx.restore();
}

/**
 * Exports the 30.00-second 3D film as a downloadable MP4 file (1920x1080 when supported,
 * else 1280x720) with English voices, two crossfaded instrumental tracks, foley SFX, and burned-in subtitles.
 */
export async function exportCompletedMp4(
  pkg: GeneratedVideoPackage,
  options: { voiceVolume: number; musicVolume: number },
  onProgress?: (percent: number, stage: string) => void
): Promise<Blob> {
  onProgress?.(4, "Mixing English voices, two music tracks & sound effects...");
  const sampleRate = 48000;
  const mixedAudio = await renderMixedAudioBuffer(
    pkg,
    options.voiceVolume,
    options.musicVolume,
    sampleRate
  );

  const hasWebCodecs =
    typeof VideoEncoder !== "undefined" && typeof AudioEncoder !== "undefined";

  let exportWidth = 1920;
  let exportHeight = 1080;
  let videoCodec: "avc" | "vp9" | null = null;
  let videoCodecString = "";
  let audioCodec: "aac" | "opus" | null = null;
  let audioCodecString = "";

  if (hasWebCodecs) {
    const tryVideo = async (w: number, h: number) => {
      const avc = await VideoEncoder.isConfigSupported({
        codec: "avc1.4d002a",
        width: w,
        height: h,
        bitrate: w === 1920 ? 5_500_000 : 3_500_000,
        framerate: 30,
      }).catch(() => ({ supported: false }));
      if (avc.supported) {
        return { codec: "avc" as const, str: "avc1.4d002a" };
      }
      const avcBase = await VideoEncoder.isConfigSupported({
        codec: "avc1.420028",
        width: w,
        height: h,
        bitrate: w === 1920 ? 5_500_000 : 3_500_000,
        framerate: 30,
      }).catch(() => ({ supported: false }));
      if (avcBase.supported) {
        return { codec: "avc" as const, str: "avc1.420028" };
      }
      const vp9 = await VideoEncoder.isConfigSupported({
        codec: "vp09.00.10.08",
        width: w,
        height: h,
        bitrate: w === 1920 ? 4_500_000 : 3_000_000,
        framerate: 30,
      }).catch(() => ({ supported: false }));
      if (vp9.supported) {
        return { codec: "vp9" as const, str: "vp09.00.10.08" };
      }
      return null;
    };

    const res1080 = await tryVideo(1920, 1080);
    if (res1080) {
      exportWidth = 1920;
      exportHeight = 1080;
      videoCodec = res1080.codec;
      videoCodecString = res1080.str;
    } else {
      const res720 = await tryVideo(1280, 720);
      if (res720) {
        exportWidth = 1280;
        exportHeight = 720;
        videoCodec = res720.codec;
        videoCodecString = res720.str;
      }
    }

    const aacCheck = await AudioEncoder.isConfigSupported({
      codec: "mp4a.40.2",
      sampleRate,
      numberOfChannels: 2,
      bitrate: 160_000,
    }).catch(() => ({ supported: false }));
    if (aacCheck.supported) {
      audioCodec = "aac";
      audioCodecString = "mp4a.40.2";
    } else {
      const opusCheck = await AudioEncoder.isConfigSupported({
        codec: "opus",
        sampleRate,
        numberOfChannels: 2,
        bitrate: 160_000,
      }).catch(() => ({ supported: false }));
      if (opusCheck.supported) {
        audioCodec = "opus";
        audioCodecString = "opus";
      }
    }
  }

  const glCanvas = document.createElement("canvas");
  glCanvas.width = exportWidth;
  glCanvas.height = exportHeight;

  let stage3D: ThreeFilmStage | null = null;
  try {
    stage3D = new ThreeFilmStage(glCanvas);
    stage3D.setSize(exportWidth, exportHeight);
  } catch {
    stage3D = null;
  }

  const compositeCanvas = document.createElement("canvas");
  compositeCanvas.width = exportWidth;
  compositeCanvas.height = exportHeight;
  const compCtx = compositeCanvas.getContext("2d");
  if (!compCtx) {
    stage3D?.dispose();
    throw new Error("Could not initialize 2D composite canvas.");
  }

  const renderCompositeFrame = (timeSec: number) => {
    if (stage3D) {
      stage3D.renderAtTime({
        timeSec,
        style: pkg.style,
        mode: pkg.mode,
        timedLines: pkg.timedLines,
        timelineMarkers: pkg.timelineMarkers,
      });
      compCtx.drawImage(glCanvas, 0, 0, exportWidth, exportHeight);
    } else {
      compCtx.save();
      compCtx.scale(exportWidth / 1280, exportHeight / 720);
      render2DFallbackFrame(compCtx, {
        timeSec,
        style: pkg.style,
        mode: pkg.mode === "3d-slideshow" ? "slideshow" : "animation",
        timedLines: pkg.timedLines,
        timedSegments: pkg.timedSegments,
        timelineMarkers: pkg.timelineMarkers,
        drawSubtitles: false,
      });
      compCtx.restore();
    }

    drawBurnedSubtitlesAndCredit(
      compCtx,
      exportWidth,
      exportHeight,
      timeSec,
      pkg.timedLines,
      pkg.timedSegments,
      pkg.timelineMarkers
    );
  };

  try {
    if (videoCodec && audioCodec) {
      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: {
          codec: videoCodec,
          width: exportWidth,
          height: exportHeight,
          frameRate: 30,
        },
        audio: {
          codec: audioCodec,
          numberOfChannels: 2,
          sampleRate,
        },
        fastStart: "in-memory",
      });

      const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => {
          throw e;
        },
      });
      videoEncoder.configure({
        codec: videoCodecString,
        width: exportWidth,
        height: exportHeight,
        bitrate: exportWidth === 1920 ? 5_500_000 : 3_500_000,
        framerate: 30,
      });

      const audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error: (e) => {
          throw e;
        },
      });
      audioEncoder.configure({
        codec: audioCodecString,
        sampleRate,
        numberOfChannels: 2,
        bitrate: 160_000,
      });

      onProgress?.(12, `Encoding audio & ${exportWidth}×${exportHeight} 3D frames...`);
      const left = mixedAudio.getChannelData(0);
      const right = mixedAudio.getChannelData(1);
      const chunkFrames = 1024;
      for (let offset = 0; offset < left.length; offset += chunkFrames) {
        const count = Math.min(chunkFrames, left.length - offset);
        const planar = new Float32Array(count * 2);
        planar.set(left.subarray(offset, offset + count), 0);
        planar.set(right.subarray(offset, offset + count), count);

        const audioData = new AudioData({
          format: "f32-planar",
          sampleRate,
          numberOfFrames: count,
          numberOfChannels: 2,
          timestamp: Math.round((offset / sampleRate) * 1_000_000),
          data: planar,
        });
        audioEncoder.encode(audioData);
        audioData.close();
      }

      const fps = 30;
      const totalFrames = 30 * fps;
      for (let f = 0; f < totalFrames; f++) {
        const timeSec = f / fps;
        renderCompositeFrame(timeSec);

        const frame = new VideoFrame(compositeCanvas, {
          timestamp: Math.round((f / fps) * 1_000_000),
          duration: Math.round((1 / fps) * 1_000_000),
        });
        videoEncoder.encode(frame, { keyFrame: f % 60 === 0 });
        frame.close();

        if (f % 15 === 0) {
          const pct = 15 + Math.round((f / totalFrames) * 80);
          onProgress?.(
            pct,
            `Rendering ${exportWidth}×${exportHeight} frame ${f + 1}/${totalFrames}...`
          );
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      onProgress?.(96, "Finalizing MP4 file...");
      await videoEncoder.flush();
      await audioEncoder.flush();
      muxer.finalize();

      onProgress?.(100, "Ready!");
      return new Blob([target.buffer], { type: "video/mp4" });
    }

    return await exportViaMediaRecorder(
      compositeCanvas,
      renderCompositeFrame,
      mixedAudio,
      onProgress
    );
  } finally {
    stage3D?.dispose();
  }
}

async function exportViaMediaRecorder(
  compositeCanvas: HTMLCanvasElement,
  renderCompositeFrame: (timeSec: number) => void,
  mixedAudio: AudioBuffer,
  onProgress?: (percent: number, stage: string) => void
): Promise<Blob> {
  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();
  const src = audioCtx.createBufferSource();
  src.buffer = mixedAudio;
  src.connect(dest);

  const canvasStream = compositeCanvas.captureStream(30);
  const combined = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const mimeType = MediaRecorder.isTypeSupported("video/mp4")
    ? "video/mp4"
    : "video/webm;codecs=vp8,opus";

  const recorder = new MediaRecorder(combined, { mimeType });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return await new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      audioCtx.close().catch(() => undefined);
      resolve(new Blob(chunks, { type: "video/mp4" }));
    };
    recorder.onerror = (e) => reject(e);

    recorder.start(250);
    src.start(0);
    const startMs = performance.now();

    const tick = () => {
      const elapsedSec = (performance.now() - startMs) / 1000;
      if (elapsedSec >= 30) {
        renderCompositeFrame(30);
        recorder.stop();
        onProgress?.(100, "Ready!");
        return;
      }

      renderCompositeFrame(elapsedSec);
      onProgress?.(
        10 + Math.round((elapsedSec / 30) * 85),
        `Recording ${elapsedSec.toFixed(1)}s / 30.0s...`
      );
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
