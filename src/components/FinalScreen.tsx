import {
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  Sparkles,
  Volume2,
} from "lucide-react";
import { useState } from "react";
import { countTotalScriptWords, FILM_CREDIT_TEXT } from "../data/defaults";
import type {
  Beat,
  ExpressionItem,
  GeneratedVideoPackage,
  SceneSettings,
} from "../types";
import {
  buildVideoPackage,
  exportCompletedMp4,
  rebuildSingleBeatInPackage,
} from "../utils/videoEngine";
import { StoryPlayer } from "./StoryPlayer";

interface FinalScreenProps {
  beats: Beat[];
  expressions: ExpressionItem[];
  scene: SceneSettings;
  videoPackage: GeneratedVideoPackage | null;
  voiceVolume: number;
  musicVolume: number;
  onChangeVoiceVolume: (v: number) => void;
  onChangeMusicVolume: (v: number) => void;
  onChangeBeats: (next: Beat[]) => void;
  onVideoGenerated: (pkg: GeneratedVideoPackage) => void;
  onGoToVideo: () => void;
}

export function FinalScreen({
  beats,
  expressions,
  scene,
  videoPackage,
  voiceVolume,
  musicVolume,
  onChangeVoiceVolume,
  onChangeMusicVolume,
  onChangeBeats,
  onVideoGenerated,
  onGoToVideo,
}: FinalScreenProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportPct, setExportPct] = useState(0);
  const [exportStage, setExportStage] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const [isQuickBuilding, setIsQuickBuilding] = useState(false);
  const [regeneratingBeatId, setRegeneratingBeatId] = useState<string | null>(
    null
  );
  const [speakingExprId, setSpeakingExprId] = useState<string | null>(null);

  const totalWordCount = countTotalScriptWords(beats);

  const handleQuickBuild = async () => {
    setIsQuickBuilding(true);
    setExportError(null);
    try {
      const pkg = await buildVideoPackage(beats, scene.style);
      onVideoGenerated(pkg);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "Failed to prepare 3D film."
      );
    } finally {
      setIsQuickBuilding(false);
    }
  };

  const handleRegenerateSingleScene = async (beat: Beat) => {
    setRegeneratingBeatId(beat.id);
    setExportError(null);
    try {
      const summary = beats
        .map(
          (b) =>
            `Beat ${b.number} (${b.title}, ${b.startSec}-${b.endSec}s): ${b.sceneDescription}`
        )
        .join("\n");

      const res = await fetch("/api/regenerate-beat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beatNumber: beat.number,
          beatTitle: beat.title,
          startSec: beat.startSec,
          endSec: beat.endSec,
          learningExpressions: beat.learningExpressions,
          sceneSettings: scene,
          otherBeatsSummary: summary,
          currentWordCount: beat.lines.reduce(
            (a, l) => a + l.text.trim().split(/\s+/).filter(Boolean).length,
            0
          ),
          totalScriptWordCount: totalWordCount,
          currentCameraDirection: beat.cameraDirection,
          currentLightingDirection: beat.lightingDirection,
          currentMusicDirection: beat.musicDirection,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        sceneDescription?: string;
        lines?: Array<{ speaker: "Square" | "Circle"; text: string }>;
        koreanMeaning?: string;
        cameraDirection?: string;
        lightingDirection?: string;
        musicDirection?: string;
      };

      if (!res.ok || !data.lines || data.lines.length === 0) {
        throw new Error(data.error || "Could not regenerate scene.");
      }

      const updatedBeat: Beat = {
        ...beat,
        sceneDescription: data.sceneDescription || beat.sceneDescription,
        cameraDirection: data.cameraDirection || beat.cameraDirection,
        lightingDirection: data.lightingDirection || beat.lightingDirection,
        musicDirection: data.musicDirection || beat.musicDirection,
        koreanMeaning: data.koreanMeaning || beat.koreanMeaning,
        lines: data.lines.map((l, i) => ({
          id: `${beat.id}-final-regen-${Date.now()}-${i}`,
          speaker: l.speaker,
          text: l.text,
        })),
      };

      const nextBeats = beats.map((b) => (b.id === beat.id ? updatedBeat : b));
      onChangeBeats(nextBeats);

      if (videoPackage) {
        const updatedPkg = await rebuildSingleBeatInPackage(
          videoPackage,
          updatedBeat
        );
        onVideoGenerated(updatedPkg);
      }
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "Failed to regenerate scene."
      );
    } finally {
      setRegeneratingBeatId(null);
    }
  };

  const handleDownloadMp4 = async () => {
    if (!videoPackage) return;
    setIsExporting(true);
    setExportError(null);
    setDownloadSuccess(false);
    setExportPct(2);
    setExportStage("Preparing 3D frames & audio mix...");

    try {
      const blob = await exportCompletedMp4(
        videoPackage,
        { voiceVolume, musicVolume },
        (pct, stage) => {
          setExportPct(pct);
          setExportStage(stage);
        }
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "shape-of-me.mp4";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setDownloadSuccess(true);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "Failed to export MP4 file."
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleSpeakExpression = async (item: ExpressionItem) => {
    setSpeakingExprId(item.id);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: item.expression, speaker: "Square" }),
      });
      if (res.ok) {
        const data = (await res.json()) as { audioBase64?: string };
        if (data.audioBase64) {
          const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
          await audio.play();
          audio.onended = () => setSpeakingExprId(null);
          return;
        }
      }
    } catch {
      // Fallback to browser synthesis
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(item.expression);
      utter.lang = "en-US";
      utter.rate = 0.9;
      utter.onend = () => setSpeakingExprId(null);
      window.speechSynthesis.speak(utter);
    } else {
      setSpeakingExprId(null);
    }
  };

  return (
    <section className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-[#75726B]">
            Step 5 of 5 · Screening, Export & Study Review
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#484744] text-balance">
            {scene.title || "Shape of Me"}
          </h1>
          <p className="text-sm sm:text-base text-[#66645F]">
            Play your completed 30-second 3D short film, balance voice and
            music levels, regenerate individual scenes, or download as MP4.
          </p>
        </div>

        {videoPackage && (
          <button
            type="button"
            disabled={isExporting}
            onClick={handleDownloadMp4}
            className="w-full sm:w-auto min-h-[50px] px-6 py-3 rounded-xl bg-[#6F876B] text-white font-semibold text-base hover:bg-[#5E745A] disabled:opacity-65 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-xs"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Exporting MP4 ({exportPct}%)...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>Download MP4</span>
              </>
            )}
          </button>
        )}
      </div>

      {isExporting && (
        <div className="bg-white/90 border border-[#D8D2C7] rounded-2xl p-4 space-y-2">
          <div className="h-2.5 w-full rounded-full bg-[#EAE4D8] overflow-hidden">
            <div
              className="h-full bg-[#6F876B] transition-all duration-200"
              style={{ width: `${exportPct}%` }}
            />
          </div>
          <p className="text-xs text-[#66645F]">{exportStage}</p>
        </div>
      )}

      {downloadSuccess && (
        <div className="rounded-2xl border border-[#A4B5A0] bg-[#EBF0EA] p-4 flex items-center gap-2.5 text-sm text-[#3F533B]">
          <CheckCircle2 className="w-5 h-5 text-[#6F876B] shrink-0" />
          <span>
            Downloaded <strong>shape-of-me.mp4</strong> including English voice,
            burned-in subtitles, background music, and sound effects.
          </span>
        </div>
      )}

      {exportError && (
        <div className="rounded-2xl border border-[#DC8A7E] bg-[#FDF0EE] p-4 text-sm text-[#7D2B20]">
          {exportError}
        </div>
      )}

      {videoPackage ? (
        <StoryPlayer
          videoPackage={videoPackage}
          beats={beats}
          voiceVolume={voiceVolume}
          musicVolume={musicVolume}
          onChangeVoiceVolume={onChangeVoiceVolume}
          onChangeMusicVolume={onChangeMusicVolume}
          showAudioSliders
        />
      ) : (
        <div className="bg-white/90 border border-[#D8D2C7] rounded-2xl p-8 text-center space-y-4">
          <p className="font-display text-xl font-bold text-[#484744]">
            Your 30-second 3D short film isn’t built yet
          </p>
          <p className="text-sm text-[#66645F] max-w-md mx-auto">
            Build the 3D animation, English voices, and continuous instrumental
            soundtrack now to play and export as MP4.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-1">
            <button
              type="button"
              disabled={isQuickBuilding}
              onClick={handleQuickBuild}
              className="min-h-[48px] px-6 py-3 rounded-xl bg-[#D99A70] text-white font-semibold text-sm sm:text-base hover:bg-[#C6865B] inline-flex items-center gap-2 cursor-pointer"
            >
              {isQuickBuilding ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Building 30s 3D Film...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Generate & Play Now</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onGoToVideo}
              className="min-h-[48px] px-5 py-3 rounded-xl border border-[#D4CEC2] bg-[#FAF8F4] text-sm font-semibold text-[#484744] hover:bg-[#EFEAE0] cursor-pointer"
            >
              Back to Video Studio
            </button>
          </div>
        </div>
      )}

      {/* Final Script (with Individual Scene Regeneration) & Expressions Review */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 bg-white/90 border border-[#D8D2C7] rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#EAE4D8] pb-3">
            <h2 className="font-display text-xl font-bold text-[#484744]">
              Final English Script
            </h2>
            <span className="font-mono-tabular text-xs font-semibold text-[#5C5A55]">
              {totalWordCount} total words · 30s
            </span>
          </div>

          <div className="space-y-4">
            {beats.map((beat) => {
              const isRegen = regeneratingBeatId === beat.id;
              return (
                <div
                  key={beat.id}
                  className="space-y-2 pb-3 border-b border-[#EFEAE0] last:border-b-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[#75726B] font-mono-tabular">
                      Beat {beat.number}: {beat.title} ({beat.startSec}–
                      {beat.endSec}s)
                    </p>
                    <button
                      type="button"
                      disabled={isRegen}
                      onClick={() => handleRegenerateSingleScene(beat)}
                      className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#EBF0EA] border border-[#C5D3C1] text-[#3F533B] text-xs font-semibold hover:bg-[#DFEAE0] disabled:opacity-60 inline-flex items-center gap-1 cursor-pointer"
                    >
                      {isRegen ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      <span>Regenerate Scene</span>
                    </button>
                  </div>

                  <div className="space-y-1 pl-1">
                    {beat.lines.map((line) => (
                      <p
                        key={line.id}
                        className="text-sm sm:text-base text-[#484744] leading-relaxed"
                      >
                        <span
                          className={`font-bold mr-2 ${
                            line.speaker === "Square"
                              ? "text-[#B56E42]"
                              : "text-[#5E7859]"
                          }`}
                        >
                          {line.speaker}:
                        </span>
                        “{line.text}”
                      </p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-6 bg-white/90 border border-[#D8D2C7] rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#EAE4D8] pb-3">
            <h2 className="font-display text-xl font-bold text-[#484744]">
              Expressions Review
            </h2>
            <span className="font-mono-tabular text-xs text-[#75726B]">
              {expressions.filter((e) => e.expression.trim()).length} phrases
            </span>
          </div>

          <div className="divide-y divide-[#EAE4D8]">
            {expressions
              .filter((e) => e.expression.trim().length > 0)
              .map((item) => {
                const isSpeaking = speakingExprId === item.id;
                return (
                  <div
                    key={item.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-base font-bold text-[#484744]">
                        {item.expression}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-[#66645F]">
                        <span>{item.koreanMeaning}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#75726B]">{item.movie}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSpeakExpression(item)}
                      aria-label={`Listen to ${item.expression}`}
                      className={`min-h-[44px] min-w-[44px] px-3 rounded-xl border inline-flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                        isSpeaking
                          ? "bg-[#F7ECE3] border-[#D99A70] text-[#B56E42]"
                          : "bg-[#FAF8F4] border-[#D8D2C7] text-[#5C5A55] hover:bg-[#EFEAE0]"
                      }`}
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <footer className="pt-2 pb-6 text-center text-sm font-medium text-[#75726B]">
        {FILM_CREDIT_TEXT}
      </footer>
    </section>
  );
}
