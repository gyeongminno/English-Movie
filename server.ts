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
  beatNumber?: number;
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
1. Strictly preserve the original storyline, realistic stationery physics, and character design rules (vivid yellow hexagonal pencil #F5C518 and cobalt-blue rectangular eraser #2449D8, ONLY two small expressive eyes each, NO arms/hands/legs/feet/mouths/eyebrows/accessories).
2. You MUST include the exact learning expression(s) ${requiredExprList} verbatim (exact spelling and wording) in the English dialogue lines.
3. Keep the total spoken English words across all lines in this beat between ${minBeatWords} and ${maxBeatWords} words (aim for ~${targetWords} words) so the entire 4-beat film stays between 60 and 70 words.
4. Keep each dialogue line natural, family-friendly, emotionally resonant, and clear for Korean university English learners.
5. Provide a natural Korean translation matching the dialogue lines (with speaker prefix like 지우개: or 연필:), plus refined camera, lighting, background music (Track 1 for Beats 1–2, Track 2 for Beats 3–4), and paper/graphite/eraser sound effects.`;

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

      const normalizedLines = (parsed.lines || [])
        .filter((l) => l && typeof l.text === "string" && l.text.trim().length > 0)
        .map((l) => ({
          speaker: l.speaker?.toLowerCase().includes("eraser")
            ? ("Eraser" as const)
            : ("Pencil" as const),
          text: l.text.trim().replace(/^["']|["']$/g, ""),
        }));

      if (normalizedLines.length === 0) {
        res.status(502).json({ error: "Model returned no dialogue lines." });
        return;
      }

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

  const ttsQuotaBlockedUntil: Record<string, number> = {};

  app.post("/api/tts", async (req, res) => {
    try {
      const body = req.body as TtsBody;
      const cleanText = (body?.text ?? "").trim();
      const speaker = body?.speaker === "Eraser" ? "Eraser" : "Pencil";
      const beatNumber = typeof body?.beatNumber === "number" ? body.beatNumber : 1;

      if (!cleanText) {
        res.status(400).json({ error: "Text is required for speech synthesis." });
        return;
      }

      const toneBucket =
        speaker === "Eraser" ? (beatNumber >= 3 ? "soft" : "strict") : "pencil";
      const cacheKey = `${speaker}::${toneBucket}::${cleanText}`;
      const cached = ttsCache.get(cacheKey);
      if (cached) {
        res.json({ audioBase64: cached, mimeType: "audio/wav" });
        return;
      }

      const ai = getGeminiClient(true);

      // The Pencil: gentle, curious, creative voice (Zephyr)
      // The Eraser: slightly strict & tidy early on, gradually warmer & understanding in Beats 3–4 (Charon)
      const voiceName = speaker === "Pencil" ? "Zephyr" : "Charon";
      const stylePrompt =
        speaker === "Pencil"
          ? "Gentle, curious, creative, and expressive voice speaking clearly at a natural pace for English learners"
          : beatNumber >= 3
          ? "Warm, gentle, appreciative, and understanding voice full of wonder and sincerity, speaking clearly at a natural pace for English learners"
          : "Slightly strict, tidy, and mildly annoyed yet warm voice speaking clearly at a natural pace for English learners";

      const candidateModels = ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts"];
      const now = Date.now();
      let base64Audio: string | undefined;
      let sawQuota = false;
      let lastNonQuotaErr: unknown = null;

      for (const modelName of candidateModels) {
        if ((ttsQuotaBlockedUntil[modelName] ?? 0) > now) {
          sawQuota = true;
          continue;
        }
        try {
          const response = await withRetry(() =>
            ai.models.generateContent({
              model: modelName,
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: cleanText,
                      speechMetadata: {
                        style: stylePrompt,
                      },
                    },
                  ],
                },
              ],
              config: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName },
                  },
                },
              },
            })
          );
          base64Audio =
            response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (base64Audio) {
            break;
          }
        } catch (modelErr: unknown) {
          const msg =
            modelErr instanceof Error ? modelErr.message : String(modelErr);
          if (/429|RESOURCE_EXHAUSTED|Quota exceeded/i.test(msg)) {
            sawQuota = true;
            ttsQuotaBlockedUntil[modelName] = Date.now() + 15 * 60 * 1000;
            continue;
          }
          lastNonQuotaErr = modelErr;
        }
      }

      if (!base64Audio) {
        if (sawQuota && !lastNonQuotaErr) {
          res.json({
            audioBase64: null,
            fallback: true,
            notice:
              "Studio voice quota reached for today; using browser English voices.",
          });
          return;
        }
        const fallbackMsg =
          lastNonQuotaErr instanceof Error
            ? lastNonQuotaErr.message
            : "Studio voice temporarily unavailable; using browser English voices.";
        res.json({
          audioBase64: null,
          fallback: true,
          notice: fallbackMsg,
        });
        return;
      }

      if (ttsCache.size > 120) {
        const firstKey = ttsCache.keys().next().value;
        if (firstKey) ttsCache.delete(firstKey);
      }
      ttsCache.set(cacheKey, base64Audio);

      res.json({ audioBase64: base64Audio, mimeType: "audio/wav" });
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : "Speech synthesis failed.";
      res.json({
        audioBase64: null,
        fallback: true,
        notice: /429|RESOURCE_EXHAUSTED|Quota exceeded/i.test(rawMsg)
          ? "Studio voice quota reached for today; using browser English voices."
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
