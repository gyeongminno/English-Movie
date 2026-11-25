import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment secrets.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const ttsCache = new Map<string, string>();

interface RegenerateBeatBody {
  beatNumber: number;
  beatTitle: string;
  startSec: number;
  endSec: number;
  learningExpressions: string[];
  sceneSettings: {
    title: string;
    place: string;
    squareCharacter: string;
    circlesCharacter: string;
    situation: string;
    theme: string;
    style: string;
  };
  otherBeatsSummary: string;
  currentWordCount: number;
  totalScriptWordCount: number;
  currentCameraDirection?: string;
  currentLightingDirection?: string;
  currentMusicDirection?: string;
}

interface TtsBody {
  text: string;
  speaker: "Square" | "Circle";
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

      const otherWords = Math.max(0, body.totalScriptWordCount - body.currentWordCount);
      const minBeatWords = Math.max(10, 60 - otherWords);
      const maxBeatWords = Math.max(minBeatWords + 2, 70 - otherWords);
      const targetWords = Math.min(maxBeatWords, Math.max(minBeatWords, 15));

      const requiredExprList =
        body.learningExpressions.length > 0
          ? body.learningExpressions.map((e) => `"${e}"`).join(", ")
          : "natural everyday English";

      const prompt = `You are a friendly 3D animation art director, sound designer, and short-film writer creating a 30-second minimalist 3D animated short film for Korean university students learning everyday English.

Story Context:
- Title: ${body.sceneSettings.title}
- Visual Style: ${body.sceneSettings.style}
- Place: ${body.sceneSettings.place}
- Square Character: ${body.sceneSettings.squareCharacter}
- Circles Character: ${body.sceneSettings.circlesCharacter}
- Overall Situation: ${body.sceneSettings.situation}
- Theme: ${body.sceneSettings.theme}

Full Story Arc Summary:
${body.otherBeatsSummary}

Task:
Regenerate ONLY Beat ${body.beatNumber}: ${body.beatTitle} (${body.startSec}–${body.endSec} seconds).
Requirements:
1. Strictly preserve the original storyline, calm artistic 3D aesthetic, and geometric character designs (one matte pastel-orange 3D cube and three matte sage-green 3D spheres, no extra characters).
2. You MUST include the exact learning expression(s) ${requiredExprList} verbatim (exact spelling and wording) in the English dialogue lines.
3. Keep the total spoken English words across all lines in this beat between ${minBeatWords} and ${maxBeatWords} words (aim for ~${targetWords} words) so the entire 4-beat film stays between 60 and 70 words.
4. Keep each dialogue line natural, family-friendly, emotionally resonant, and clear for Korean university English learners.
5. Provide a natural Korean translation matching the dialogue lines, plus refined camera, lighting, and background music direction matching this beat's emotional arc.`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          systemInstruction:
            "You write sophisticated, minimalist 3D short-film storyboards for English learners. Return valid JSON matching the schema.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sceneDescription: {
                type: Type.STRING,
                description: "2-3 concise sentences describing the 3D action and emotion in this beat.",
              },
              lines: {
                type: Type.ARRAY,
                description: "Ordered spoken dialogue lines for this beat.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    speaker: {
                      type: Type.STRING,
                      description: "Either Square or Circle",
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
                description: "Soft directional lighting and shadow mood note for this beat.",
              },
              musicDirection: {
                type: Type.STRING,
                description: "Restrained instrumental arrangement note for this beat.",
              },
            },
            required: [
              "sceneDescription",
              "lines",
              "koreanMeaning",
              "cameraDirection",
              "lightingDirection",
              "musicDirection",
            ],
          },
        },
      });

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
      };

      const normalizedLines = (parsed.lines || [])
        .filter((l) => l && typeof l.text === "string" && l.text.trim().length > 0)
        .map((l) => ({
          speaker: l.speaker?.toLowerCase().includes("circle")
            ? ("Circle" as const)
            : ("Square" as const),
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
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to regenerate beat.";
      console.error("Regenerate beat error:", err);
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/tts", async (req, res) => {
    try {
      const body = req.body as TtsBody;
      const cleanText = (body?.text ?? "").trim();
      const speaker = body?.speaker === "Circle" ? "Circle" : "Square";

      if (!cleanText) {
        res.status(400).json({ error: "Text is required for speech synthesis." });
        return;
      }

      const cacheKey = `${speaker}::${cleanText}`;
      const cached = ttsCache.get(cacheKey);
      if (cached) {
        res.json({ audioBase64: cached, mimeType: "audio/wav" });
        return;
      }

      const ai = getGeminiClient();

      const voiceName = speaker === "Square" ? "Zephyr" : "Puck";
      const stylePrompt =
        speaker === "Square"
          ? "Gentle, slightly shy, emotionally expressive young voice speaking clearly at a natural pace for English learners"
          : "Friendly, warm, cheerful voice speaking clearly at a natural pace for English learners";

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash-lite-tts",
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
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        res.status(502).json({ error: "TTS model returned no audio data." });
        return;
      }

      if (ttsCache.size > 120) {
        const firstKey = ttsCache.keys().next().value;
        if (firstKey) ttsCache.delete(firstKey);
      }
      ttsCache.set(cacheKey, base64Audio);

      res.json({ audioBase64: base64Audio, mimeType: "audio/wav" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Speech synthesis failed.";
      console.error("TTS error:", err);
      res.status(500).json({ error: message });
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
    console.log(`Shape of Me server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
