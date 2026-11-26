import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getGeminiClient(useBeta = false): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment secrets.");
  }
  return new GoogleGenAI({
    apiKey,
    ...(useBeta ? { apiVersion: "v1beta" } : {}),
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isDailyQuota = /RequestsPerDay|Quota exceeded/i.test(msg);
      const isTransient =
        !isDailyQuota &&
        /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|DEADLINE_EXCEEDED/i.test(msg);
      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 700 * Math.pow(2, attempt - 1)));
    }
  }
  throw lastErr;
}

interface AlignedWord {
  word: string;
  startSec: number;
  endSec: number;
}

interface AlignedSegment {
  text: string;
  startSec: number;
  endSec: number;
  words: AlignedWord[];
}

interface AudioAlignmentResult {
  rawDurationSec: number;
  speechOnsetSec: number;
  speechOffsetSec: number;
  segments: AlignedSegment[];
  method: "gemini-audio-forced-alignment+pcm-vad" | "pcm-vad-syllable-dp";
}

interface CachedTtsEntry {
  audioBase64: string;
  alignment: AudioAlignmentResult;
}

const ttsCache = new Map<string, CachedTtsEntry>();

interface RegenerateBeatBody {
  beatNumber: number;
  beatTitle: string;
  startSec: number;
  endSec: number;
  learningExpressions: string[];
  sceneSettings?: {
    title?: string;
    place?: string;
    pencilCharacter?: string;
    eraserCharacter?: string;
    situation?: string;
    theme?: string;
    style?: string;
  };
  otherBeatsSummary?: string;
  currentWordCount?: number;
  totalScriptWordCount?: number;
  currentCameraDirection?: string;
  currentLightingDirection?: string;
  currentMusicDirection?: string;
  currentSoundEffects?: string;
}

interface TtsBody {
  text: string;
  speaker: "Pencil" | "Eraser";
  voiceId?: "PENCIL_VOICE" | "ERASER_VOICE";
  beatNumber?: number;
  segments?: string[];
}

const FIXED_TTS_MODEL = "gemini-3.8-flash-tts" as const;

const LOCKED_VOICE_PROFILES = {
  PENCIL_VOICE: {
    voiceName: "Zephyr",
    baseIdentity:
      "Voice ID PENCIL_VOICE (Yellow Pencil): bright, gentle, warm, youthful medium-high American English voice, curious and expressive, clear natural pronunciation. Maintain this exact same vocal identity, register, accent, and timbre across every scene.",
    emotions: {
      1: "Gentle, curious, and warm.",
      2: "Initially slightly nervous, gradually becoming determined and hopeful.",
      3: "Gentle and warm.",
      4: "Understanding, cheerful, and warm.",
    } as Record<number, string>,
  },
  ERASER_VOICE: {
    voiceName: "Charon",
    baseIdentity:
      "Voice ID ERASER_VOICE (Cobalt-Blue Eraser): calm, clear, composed medium-low American English voice, articulate with clear natural pronunciation. Maintain this exact same vocal identity, register, accent, and timbre across every scene.",
    emotions: {
      1: "Surprised, dissatisfied, and slightly strict.",
      2: "Firm and composed.",
      3: "Surprised, impressed, and increasingly warm.",
      4: "Gentle, apologetic, and sincere.",
    } as Record<number, string>,
  },
} as const;

function enforceBeatSpeakers(
  beatNumber: number,
  lines: Array<{ speaker: "Pencil" | "Eraser"; text: string }>
): Array<{ speaker: "Pencil" | "Eraser"; text: string }> {
  if (beatNumber === 1 || beatNumber === 3) {
    return [{ speaker: "Eraser", text: lines.map((l) => l.text).join(" ").trim() }];
  }
  if (beatNumber === 2) {
    return [{ speaker: "Pencil", text: lines.map((l) => l.text).join(" ").trim() }];
  }
  if (lines.length === 1) {
    return [{ speaker: "Eraser", text: lines[0].text }];
  }
  const splitIdx = Math.ceil(lines.length / 2);
  return [
    {
      speaker: "Eraser",
      text: lines
        .slice(0, splitIdx)
        .map((l) => l.text)
        .join(" ")
        .trim(),
    },
    {
      speaker: "Pencil",
      text: lines
        .slice(splitIdx)
        .map((l) => l.text)
        .join(" ")
        .trim(),
    },
  ];
}

interface PcmPause {
  startSec: number;
  endSec: number;
  midSec: number;
  durSec: number;
}

interface PcmAnalysis {
  durationSec: number;
  speechOnsetSec: number;
  speechOffsetSec: number;
  frameDurSec: number;
  rmsFrames: number[];
  pauses: PcmPause[];
}

function analyzeWavPcm(base64Wav: string): PcmAnalysis {
  const buf = Buffer.from(base64Wav, "base64");
  let sampleRate = 24000;
  let numChannels = 1;
  let bitsPerSample = 16;
  let dataOffset = 44;
  let dataSize = Math.max(0, buf.length - 44);

  if (buf.length >= 44 && buf.toString("ascii", 0, 4) === "RIFF") {
    let pos = 12;
    while (pos + 8 <= buf.length) {
      const id = buf.toString("ascii", pos, pos + 4);
      const size = buf.readUInt32LE(pos + 4);
      if (id === "fmt " && pos + 24 <= buf.length) {
        numChannels = Math.max(1, buf.readUInt16LE(pos + 10));
        sampleRate = Math.max(8000, buf.readUInt32LE(pos + 12));
        bitsPerSample = Math.max(8, buf.readUInt16LE(pos + 22));
      } else if (id === "data") {
        dataOffset = pos + 8;
        dataSize = Math.min(size, buf.length - dataOffset);
        break;
      }
      pos += 8 + size + (size % 2);
    }
  }

  const bytesPerSample = Math.max(1, Math.floor(bitsPerSample / 8));
  const frameStride = bytesPerSample * numChannels;
  const totalSamples = Math.floor(dataSize / frameStride);
  const durationSec = totalSamples / sampleRate;

  const frameDurSec = 0.01;
  const samplesPerFrame = Math.max(1, Math.round(sampleRate * frameDurSec));
  const frameCount = Math.max(1, Math.floor(totalSamples / samplesPerFrame));
  const rmsFrames: number[] = new Array(frameCount).fill(0);

  for (let f = 0; f < frameCount; f++) {
    let sumSq = 0;
    const startSample = f * samplesPerFrame;
    for (let s = 0; s < samplesPerFrame; s++) {
      const bytePos = dataOffset + (startSample + s) * frameStride;
      if (bytePos + 1 >= buf.length) break;
      const val =
        bytesPerSample === 2
          ? buf.readInt16LE(bytePos) / 32768
          : (buf.readUInt8(bytePos) - 128) / 128;
      sumSq += val * val;
    }
    rmsFrames[f] = Math.sqrt(sumSq / samplesPerFrame);
  }

  const nonZero = rmsFrames.filter((v) => v > 0.0001).sort((a, b) => a - b);
  const noiseFloor =
    nonZero.length > 0 ? nonZero[Math.floor(nonZero.length * 0.12)] : 0.002;
  const speechPeak =
    nonZero.length > 0 ? nonZero[Math.floor(nonZero.length * 0.92)] : 0.08;
  const thresh = Math.max(0.0055, noiseFloor * 2.8, speechPeak * 0.055);

  let onsetFrame = 0;
  for (let f = 0; f < frameCount; f++) {
    const windowHits =
      (rmsFrames[f] >= thresh ? 1 : 0) +
      (f + 1 < frameCount && rmsFrames[f + 1] >= thresh ? 1 : 0) +
      (f + 2 < frameCount && rmsFrames[f + 2] >= thresh ? 1 : 0);
    if (windowHits >= 2) {
      onsetFrame = f;
      break;
    }
  }

  let offsetFrame = frameCount - 1;
  for (let f = frameCount - 1; f >= onsetFrame; f--) {
    const windowHits =
      (rmsFrames[f] >= thresh ? 1 : 0) +
      (f - 1 >= 0 && rmsFrames[f - 1] >= thresh ? 1 : 0);
    if (windowHits >= 1 && rmsFrames[f] >= thresh * 0.9) {
      offsetFrame = f;
      break;
    }
  }

  const speechOnsetSec = Number((onsetFrame * frameDurSec).toFixed(3));
  const speechOffsetSec = Number(
    Math.min(durationSec, (offsetFrame + 1) * frameDurSec).toFixed(3)
  );

  const pauses: PcmPause[] = [];
  let quietStart = -1;
  for (let f = onsetFrame; f <= offsetFrame; f++) {
    if (rmsFrames[f] < thresh) {
      if (quietStart === -1) quietStart = f;
    } else if (quietStart !== -1) {
      const len = f - quietStart;
      if (len >= 6) {
        const startSec = quietStart * frameDurSec;
        const endSec = f * frameDurSec;
        pauses.push({
          startSec,
          endSec,
          midSec: (startSec + endSec) / 2,
          durSec: endSec - startSec,
        });
      }
      quietStart = -1;
    }
  }

  return {
    durationSec: Number(durationSec.toFixed(3)),
    speechOnsetSec,
    speechOffsetSec: Math.max(speechOnsetSec + 0.25, speechOffsetSec),
    frameDurSec,
    rmsFrames,
    pauses,
  };
}

function estimatePhraseWeight(text: string): number {
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

function distributeWordsInSegment(
  segText: string,
  startSec: number,
  endSec: number,
  geminiWords?: AlignedWord[]
): AlignedWord[] {
  const words = segText.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  if (
    geminiWords &&
    geminiWords.length === words.length &&
    geminiWords.every(
      (w, idx) =>
        w.startSec < w.endSec &&
        w.startSec >= startSec - 0.15 &&
        w.endSec <= endSec + 0.15 &&
        (idx === 0 || w.startSec >= geminiWords[idx - 1].startSec - 0.02)
    )
  ) {
    return words.map((word, idx) => {
      const gw = geminiWords[idx];
      const ws = Math.max(startSec, Math.min(endSec - 0.03, gw.startSec));
      const we = Math.max(ws + 0.03, Math.min(endSec, gw.endSec));
      return {
        word,
        startSec: Number(ws.toFixed(3)),
        endSec: Number(we.toFixed(3)),
      };
    });
  }

  const weights = words.map((w) => {
    const syl = w.toLowerCase().match(/[aeiouy]+/g)?.length || 1;
    return Math.max(1, syl) * 0.65 + 0.35;
  });
  const totalW = weights.reduce((a, b) => a + b, 0) || 1;
  const span = Math.max(0.1, endSec - startSec);
  let cursor = startSec;

  return words.map((word, i) => {
    const dur =
      i === words.length - 1 ? endSec - cursor : span * (weights[i] / totalW);
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

async function alignAudioWithGemini(
  base64Wav: string,
  segments: string[],
  durationSec: number
): Promise<Array<{ startSec: number; endSec: number; words?: AlignedWord[] }> | null> {
  if (!process.env.GEMINI_API_KEY || segments.length === 0) return null;
  try {
    const ai = getGeminiClient();
    const numbered = segments.map((s, i) => `${i}: "${s}"`).join("\n");
    const call = ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "audio/wav",
              data: base64Wav,
            },
          },
          {
            text: `Listen carefully to this ${durationSec.toFixed(2)}-second English speech audio and perform exact forced alignment for the following ordered subtitle segments:\n${numbered}\n\nReturn the exact startSec and endSec (in decimal seconds from 0.00 to ${durationSec.toFixed(2)}) for every segment index 0..${segments.length - 1}, along with each spoken word's startSec and endSec.`,
          },
        ],
      },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            segments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  index: { type: Type.INTEGER },
                  startSec: { type: Type.NUMBER },
                  endSec: { type: Type.NUMBER },
                  words: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        word: { type: Type.STRING },
                        startSec: { type: Type.NUMBER },
                        endSec: { type: Type.NUMBER },
                      },
                      required: ["word", "startSec", "endSec"],
                    },
                  },
                },
                required: ["index", "startSec", "endSec"],
              },
            },
          },
          required: ["segments"],
        },
      },
    });

    const resp = await Promise.race([
      call,
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("Alignment timeout")), 8000)
      ),
    ]);
    const txt = (resp.text ?? "").trim();
    if (!txt) return null;
    const parsed = JSON.parse(txt) as {
      segments?: Array<{
        index: number;
        startSec: number;
        endSec: number;
        words?: AlignedWord[];
      }>;
    };
    if (!parsed.segments || parsed.segments.length !== segments.length) {
      return null;
    }
    const sorted = [...parsed.segments].sort((a, b) => a.index - b.index);
    const valid = sorted.every(
      (s, idx) =>
        typeof s.startSec === "number" &&
        typeof s.endSec === "number" &&
        s.startSec >= 0 &&
        s.endSec > s.startSec &&
        s.endSec <= durationSec + 0.2 &&
        (idx === 0 || s.startSec >= sorted[idx - 1].endSec - 0.15)
    );
    return valid ? sorted : null;
  } catch {
    return null;
  }
}

function buildAlignedSegments(
  segmentsInput: string[],
  pcm: PcmAnalysis,
  geminiAligned: Array<{ startSec: number; endSec: number; words?: AlignedWord[] }> | null
): AudioAlignmentResult {
  const segments = segmentsInput.map((s) => s.trim()).filter(Boolean);
  const segStart0 = Math.max(0, Number((pcm.speechOnsetSec - 0.02).toFixed(3)));
  const segEndLast = Math.min(
    pcm.durationSec,
    Number((pcm.speechOffsetSec + 0.05).toFixed(3))
  );

  if (segments.length <= 1) {
    const text = segments[0] || "";
    return {
      rawDurationSec: pcm.durationSec,
      speechOnsetSec: segStart0,
      speechOffsetSec: segEndLast,
      segments: [
        {
          text,
          startSec: segStart0,
          endSec: Math.max(segStart0 + 0.25, segEndLast),
          words: distributeWordsInSegment(
            text,
            segStart0,
            Math.max(segStart0 + 0.25, segEndLast),
            geminiAligned?.[0]?.words
          ),
        },
      ],
      method: geminiAligned
        ? "gemini-audio-forced-alignment+pcm-vad"
        : "pcm-vad-syllable-dp",
    };
  }

  const N = segments.length;
  const weights = segments.map(estimatePhraseWeight);
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
  const activeSpan = Math.max(0.4, segEndLast - segStart0);

  // Expected boundaries k = 1..N-1
  const expectedBoundaries: number[] = [];
  let cumW = 0;
  for (let k = 0; k < N - 1; k++) {
    cumW += weights[k];
    const sylB = segStart0 + activeSpan * (cumW / totalWeight);
    if (geminiAligned) {
      const gemB =
        (geminiAligned[k].endSec + geminiAligned[k + 1].startSec) / 2;
      expectedBoundaries.push(0.65 * gemB + 0.35 * sylB);
    } else {
      expectedBoundaries.push(sylB);
    }
  }

  // Monotonic greedy/DP matching from N-1 boundaries to detected acoustic pauses
  const chosenPause: Array<PcmPause | null> = new Array(N - 1).fill(null);
  const pauses = pcm.pauses;

  if (pauses.length > 0) {
    // Score matrix [boundary k][pause j]
    let minPauseIdx = 0;
    for (let k = 0; k < N - 1; k++) {
      const target = expectedBoundaries[k];
      let bestIdx = -1;
      let bestScore = -Infinity;
      const prevBound = k === 0 ? segStart0 + 0.22 : (chosenPause[k - 1]?.midSec ?? expectedBoundaries[k - 1]) + 0.25;
      const remainingNeed = (N - 2 - k) * 0.28;
      const maxBound = segEndLast - 0.25 - remainingNeed;

      for (let j = minPauseIdx; j < pauses.length; j++) {
        const p = pauses[j];
        if (p.midSec < prevBound || p.midSec > maxBound) continue;
        const dist = Math.abs(p.midSec - target);
        if (dist > 0.78) continue;
        const score = p.durSec * 3.0 - dist * 1.9;
        if (score > bestScore) {
          bestScore = score;
          bestIdx = j;
        }
      }
      if (bestIdx !== -1) {
        chosenPause[k] = pauses[bestIdx];
        minPauseIdx = bestIdx + 1;
      }
    }
  }

  // Compute exact segment boundaries [startSec, endSec] snapped to acoustic pauses or RMS minima
  const segStarts: number[] = new Array(N).fill(0);
  const segEnds: number[] = new Array(N).fill(0);
  segStarts[0] = segStart0;
  segEnds[N - 1] = Math.max(segStart0 + 0.4, segEndLast);

  for (let k = 0; k < N - 1; k++) {
    const p = chosenPause[k];
    if (p) {
      const endPrev = Math.min(p.endSec - 0.02, p.startSec + 0.045);
      const startNext = Math.max(endPrev, p.endSec - 0.03);
      segEnds[k] = Number(Math.max(segStarts[k] + 0.18, endPrev).toFixed(3));
      segStarts[k + 1] = Number(
        Math.min(segEnds[N - 1] - 0.18 * (N - 1 - k), Math.max(segEnds[k], startNext)).toFixed(3)
      );
    } else {
      const minBound = segStarts[k] + 0.22;
      const maxBound = segEnds[N - 1] - 0.22 * (N - 1 - k);
      const center = Math.max(minBound, Math.min(maxBound, expectedBoundaries[k]));
      const searchStart = Math.max(minBound, center - 0.2);
      const searchEnd = Math.min(maxBound, center + 0.2);
      const f0 = Math.floor(searchStart / pcm.frameDurSec);
      const f1 = Math.min(
        pcm.rmsFrames.length - 1,
        Math.ceil(searchEnd / pcm.frameDurSec)
      );
      let bestF = Math.round(center / pcm.frameDurSec);
      let bestRms = Infinity;
      for (let f = f0; f <= f1; f++) {
        if (pcm.rmsFrames[f] < bestRms) {
          bestRms = pcm.rmsFrames[f];
          bestF = f;
        }
      }
      const splitSec = Number((bestF * pcm.frameDurSec).toFixed(3));
      segEnds[k] = Math.max(segStarts[k] + 0.18, splitSec);
      segStarts[k + 1] = segEnds[k];
    }
  }

  const alignedSegments: AlignedSegment[] = segments.map((text, idx) => ({
    text,
    startSec: segStarts[idx],
    endSec: Math.max(segStarts[idx] + 0.15, segEnds[idx]),
    words: distributeWordsInSegment(
      text,
      segStarts[idx],
      Math.max(segStarts[idx] + 0.15, segEnds[idx]),
      geminiAligned?.[idx]?.words
    ),
  }));

  return {
    rawDurationSec: pcm.durationSec,
    speechOnsetSec: segStart0,
    speechOffsetSec: segEndLast,
    segments: alignedSegments,
    method: geminiAligned
      ? "gemini-audio-forced-alignment+pcm-vad"
      : "pcm-vad-syllable-dp",
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, hasKey: Boolean(process.env.GEMINI_API_KEY) });
  });

  app.post("/api/regenerate-beat", async (req, res) => {
    try {
      const body = req.body as RegenerateBeatBody;
      if (!body || typeof body.beatNumber !== "number") {
        res.status(400).json({ error: "Invalid beat payload." });
        return;
      }

      const ai = getGeminiClient();

      const sceneSettings = {
        title: body.sceneSettings?.title || "The Little Dot",
        place:
          body.sceneSettings?.place ||
          "A minimalist three-dimensional world inspired by a large, clean sheet of warm ivory drawing paper with subtle fiber texture.",
        pencilCharacter:
          body.sceneSettings?.pencilCharacter ||
          "A vivid yellow (#F5C518) hexagonal wooden pencil with a realistically sharpened wooden tip, dark graphite lead, and only two small expressive eyes (no arms, legs, eyebrows, or mouth).",
        eraserCharacter:
          body.sceneSettings?.eraserCharacter ||
          "A saturated cobalt-blue (#2449D8) rectangular rubber eraser with softly rounded edges, matte rubber texture, and only two small expressive eyes (no arms, legs, eyebrows, or mouth).",
        situation:
          body.sceneSettings?.situation ||
          "The yellow pencil places graphite dots on clean ivory paper; the cobalt-blue eraser tries to erase them until the pencil connects the dots into an elegant flower and they finish the artwork together.",
        theme:
          body.sceneSettings?.theme ||
          "Every beautiful creation can begin with a little dot, and something considered a mistake can become something meaningful.",
        style: body.sceneSettings?.style || "Artistic cinematic 3D animation",
      };

      const learningExpressions = Array.isArray(body.learningExpressions)
        ? body.learningExpressions
        : [];
      const totalWords = Number(body.totalScriptWordCount) || 66;
      const curWords = Number(body.currentWordCount) || 16;

      const otherWords = Math.max(0, totalWords - curWords);
      const minBeatWords = Math.max(10, 60 - otherWords);
      const maxBeatWords = Math.max(minBeatWords + 2, 70 - otherWords);
      const targetWords = Math.min(maxBeatWords, Math.max(minBeatWords, 16));

      const requiredExprList =
        learningExpressions.length > 0
          ? learningExpressions.map((e) => `"${e}"`).join(", ")
          : "natural everyday English";

      const speakerLockInstruction =
        body.beatNumber === 1
          ? "Speaker LOCK: Beat 1 MUST have ONLY ONE speaker: Eraser (ERASER_VOICE). Pencil must remain silent."
          : body.beatNumber === 2
          ? "Speaker LOCK: Beat 2 MUST have ONLY ONE speaker: Pencil (PENCIL_VOICE). Eraser must remain silent."
          : body.beatNumber === 3
          ? "Speaker LOCK: Beat 3 MUST have ONLY ONE speaker: Eraser (ERASER_VOICE). Pencil must remain silent."
          : "Speaker LOCK: Beat 4 MUST have TWO sequential lines: first Eraser (ERASER_VOICE), then Pencil (PENCIL_VOICE).";

      const prompt = `You are a friendly 3D animation director, sound designer, and short-film writer creating a 30-second minimalist 3D animated short film for Korean university students learning everyday English.

Story Context:
- Title: ${sceneSettings.title}
- Visual Style: ${sceneSettings.style}
- Place: ${sceneSettings.place}
- Character 1 (Pencil): ${sceneSettings.pencilCharacter}
- Character 2 (Eraser): ${sceneSettings.eraserCharacter}
- Overall Situation: ${sceneSettings.situation}
- Main Message: ${sceneSettings.theme}

Full Story Arc Summary:
${body.otherBeatsSummary || "4-beat 30s story: Beat 1 Hook (0-7s), Beat 2 Problem (7-15s), Beat 3 Turn (15-23s), Beat 4 Close (23-30s)."}

Task:
Regenerate ONLY Beat ${body.beatNumber}: ${body.beatTitle} (${body.startSec}–${body.endSec} seconds).
Requirements:
1. ${speakerLockInstruction}
2. Strictly preserve the original storyline, realistic stationery physics, and character design rules (vivid yellow hexagonal pencil #F5C518 and cobalt-blue rectangular eraser #2449D8, ONLY two small expressive eyes each, NO arms/hands/legs/feet/mouths/eyebrows/accessories).
3. You MUST include the exact learning expression(s) ${requiredExprList} verbatim (exact spelling and wording) in the English dialogue lines.
4. Keep the total spoken English words across all lines in this beat between ${minBeatWords} and ${maxBeatWords} words (aim for ~${targetWords} words) so the entire 4-beat film stays between 60 and 70 words.
5. Keep each dialogue line natural, family-friendly, emotionally resonant, and clear for Korean university English learners.
6. Provide a natural Korean translation matching the dialogue lines (with speaker prefix like 지우개: or 연필:), plus refined camera, lighting, background music (Track 1 — Curiosity for Beats 1–2, Track 2 — Blooming for Beats 3–4), and paper/graphite/eraser sound effects.`;

      const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
        Promise.race([
          promise,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
          ),
        ]);

      const schemaConfig = {
        systemInstruction:
          "You write sophisticated, minimalist 3D short-film storyboards for English learners. Return valid JSON matching the schema.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sceneDescription: {
              type: Type.STRING,
              description: "2-4 concise sentences describing the 3D action and eye/body emotion in this beat.",
            },
            lines: {
              type: Type.ARRAY,
              description: "Ordered spoken dialogue lines for this beat.",
              items: {
                type: Type.OBJECT,
                properties: {
                  speaker: {
                    type: Type.STRING,
                    description: "Either Pencil or Eraser",
                  },
                  text: {
                    type: Type.STRING,
                    description: "Spoken English dialogue without quotation marks or speaker name.",
                  },
                },
                required: ["speaker", "text"],
              },
            },
            koreanMeaning: {
              type: Type.STRING,
              description: "Natural Korean translation of the beat's dialogue lines.",
            },
            cameraDirection: {
              type: Type.STRING,
              description: "Refined 3D camera framing and movement note for this beat.",
            },
            lightingDirection: {
              type: Type.STRING,
              description: "Soft directional studio lighting and shadow mood note for this beat.",
            },
            musicDirection: {
              type: Type.STRING,
              description: "Background Music 1 or Background Music 2 arrangement note for this beat.",
            },
            soundEffects: {
              type: Type.STRING,
              description: "Graphite tapping/scratching, paper friction, and rubber erasing sound effects note.",
            },
          },
          required: [
            "sceneDescription",
            "lines",
            "koreanMeaning",
            "cameraDirection",
            "lightingDirection",
            "musicDirection",
            "soundEffects",
          ],
        },
      };

      let response;
      try {
        response = await withTimeout(
          withRetry(
            () =>
              ai.models.generateContent({
                model: "gemini-4-hydrogen",
                contents: prompt,
                config: {
                  ...schemaConfig,
                  thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                },
              }),
            2
          ),
          10_000,
          "gemini-4-hydrogen"
        );
      } catch (primaryErr) {
        console.warn("Primary beat model failed, falling back to gemini-3.1-flash-lite:", primaryErr);
        response = await withTimeout(
          withRetry(
            () =>
              ai.models.generateContent({
                model: "gemini-3.1-flash-lite",
                contents: prompt,
                config: {
                  ...schemaConfig,
                  thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
                },
              }),
            2
          ),
          12_000,
          "gemini-3.1-flash-lite"
        );
      }

      const raw = (response.text ?? "").trim();
      if (!raw) {
        res.status(502).json({ error: "Empty response from Gemini model." });
        return;
      }

      const parsed = JSON.parse(raw) as {
        sceneDescription: string;
        lines: Array<{ speaker: string; text: string }>;
        koreanMeaning: string;
        cameraDirection?: string;
        lightingDirection?: string;
        musicDirection?: string;
        soundEffects?: string;
      };

      const rawNormalized = (parsed.lines || [])
        .filter((l) => l && typeof l.text === "string" && l.text.trim().length > 0)
        .map((l) => ({
          speaker: l.speaker?.toLowerCase().includes("eraser")
            ? ("Eraser" as const)
            : ("Pencil" as const),
          text: l.text.trim().replace(/^["']|["']$/g, ""),
        }));

      if (rawNormalized.length === 0) {
        res.status(502).json({ error: "Model returned no dialogue lines." });
        return;
      }

      const normalizedLines = enforceBeatSpeakers(body.beatNumber, rawNormalized);

      res.json({
        sceneDescription: parsed.sceneDescription?.trim() || "",
        lines: normalizedLines,
        koreanMeaning: parsed.koreanMeaning?.trim() || "",
        cameraDirection:
          parsed.cameraDirection?.trim() || body.currentCameraDirection || "",
        lightingDirection:
          parsed.lightingDirection?.trim() || body.currentLightingDirection || "",
        musicDirection:
          parsed.musicDirection?.trim() || body.currentMusicDirection || "",
        soundEffects:
          parsed.soundEffects?.trim() || body.currentSoundEffects || "",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to regenerate beat.";
      console.error("Regenerate beat error:", err);
      res.status(500).json({ error: message });
    }
  });

  let ttsQuotaBlockedUntil = 0;

  app.post("/api/tts", async (req, res) => {
    try {
      const body = req.body as TtsBody;
      const cleanText = (body?.text ?? "").trim();
      const speaker = body?.speaker === "Eraser" ? "Eraser" : "Pencil";
      const voiceId: "PENCIL_VOICE" | "ERASER_VOICE" =
        body?.voiceId === "ERASER_VOICE" || speaker === "Eraser"
          ? "ERASER_VOICE"
          : "PENCIL_VOICE";
      const beatNumber = typeof body?.beatNumber === "number" ? body.beatNumber : 1;

      if (!cleanText) {
        res.status(400).json({ error: "Text is required for speech synthesis." });
        return;
      }

      const segments = Array.isArray(body?.segments)
        ? body.segments.map((s) => String(s).trim()).filter(Boolean)
        : cleanText
            .split(/(?<=[.!?])\s+/)
            .map((s) => s.trim())
            .filter(Boolean);

      const profile = LOCKED_VOICE_PROFILES[voiceId];
      const emotionCue = profile.emotions[beatNumber] || profile.emotions[1];
      const cacheKey = `v4::${FIXED_TTS_MODEL}::${voiceId}::${profile.voiceName}::${beatNumber}::${cleanText}::${segments.join("|")}`;
      const cached = ttsCache.get(cacheKey);
      if (cached) {
        res.json({
          audioBase64: cached.audioBase64,
          mimeType: "audio/wav",
          voiceId,
          voiceName: profile.voiceName,
          model: FIXED_TTS_MODEL,
          alignment: cached.alignment,
        });
        return;
      }

      if (ttsQuotaBlockedUntil > Date.now()) {
        res.json({
          audioBase64: null,
          fallback: true,
          voiceId,
          notice:
            "Studio voice quota reached for today; using consistent two-voice browser speech.",
        });
        return;
      }

      const ai = getGeminiClient(true);
      const lockedStylePrompt = `${profile.baseIdentity} Emotional tone for this line: ${emotionCue}`;

      let base64Audio: string | undefined;
      try {
        const response = await withRetry(() =>
          ai.models.generateContent({
            model: FIXED_TTS_MODEL,
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: cleanText,
                    speechMetadata: {
                      style: lockedStylePrompt,
                    },
                  },
                ],
              },
            ],
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: profile.voiceName },
                },
              },
            },
          })
        );
        base64Audio =
          response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      } catch (modelErr: unknown) {
        const msg =
          modelErr instanceof Error ? modelErr.message : String(modelErr);
        if (/429|RESOURCE_EXHAUSTED|Quota exceeded/i.test(msg)) {
          ttsQuotaBlockedUntil = Date.now() + 15 * 60 * 1000;
          res.json({
            audioBase64: null,
            fallback: true,
            voiceId,
            notice:
              "Studio voice quota reached for today; using consistent two-voice browser speech.",
          });
          return;
        }
        throw modelErr;
      }

      if (!base64Audio) {
        res.json({
          audioBase64: null,
          fallback: true,
          voiceId,
          notice:
            "Studio voice temporarily unavailable; using consistent two-voice browser speech.",
        });
        return;
      }

      const pcm = analyzeWavPcm(base64Audio);
      const geminiAligned =
        segments.length > 1
          ? await alignAudioWithGemini(base64Audio, segments, pcm.durationSec)
          : null;
      const alignment = buildAlignedSegments(segments, pcm, geminiAligned);

      if (ttsCache.size > 120) {
        const firstKey = ttsCache.keys().next().value;
        if (firstKey) ttsCache.delete(firstKey);
      }
      ttsCache.set(cacheKey, { audioBase64: base64Audio, alignment });

      res.json({
        audioBase64: base64Audio,
        mimeType: "audio/wav",
        voiceId,
        voiceName: profile.voiceName,
        model: FIXED_TTS_MODEL,
        alignment,
      });
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : "Speech synthesis failed.";
      res.json({
        audioBase64: null,
        fallback: true,
        notice: /429|RESOURCE_EXHAUSTED|Quota exceeded/i.test(rawMsg)
          ? "Studio voice quota reached for today; using consistent two-voice browser speech."
          : rawMsg,
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`The Little Dot server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
