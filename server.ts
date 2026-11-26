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

const ttsCache = new Map<string, string>();

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

      const profile = LOCKED_VOICE_PROFILES[voiceId];
      const emotionCue = profile.emotions[beatNumber] || profile.emotions[1];
      const cacheKey = `v3::${FIXED_TTS_MODEL}::${voiceId}::${profile.voiceName}::${beatNumber}::${cleanText}`;
      const cached = ttsCache.get(cacheKey);
      if (cached) {
        res.json({
          audioBase64: cached,
          mimeType: "audio/wav",
          voiceId,
          voiceName: profile.voiceName,
          model: FIXED_TTS_MODEL,
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

      if (ttsCache.size > 120) {
        const firstKey = ttsCache.keys().next().value;
        if (firstKey) ttsCache.delete(firstKey);
      }
      ttsCache.set(cacheKey, base64Audio);

      res.json({
        audioBase64: base64Audio,
        mimeType: "audio/wav",
        voiceId,
        voiceName: profile.voiceName,
        model: FIXED_TTS_MODEL,
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
