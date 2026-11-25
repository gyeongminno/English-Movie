import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Film,
  Loader2,
  Music,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Square,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Beat, GeneratedVideoPackage, SceneSettings } from "../types";
import {
  decodeCustomMusicFile,
  generateOriginalSoundtrack,
} from "../utils/soundtrackEngine";
import { ThreeFilmStage } from "../utils/threeRenderer";
import { buildVideoPackage } from "../utils/videoEngine";
import { StoryPlayer } from "./StoryPlayer";

interface VideoScreenProps {
  beats: Beat[];
  scene: SceneSettings;
  videoPackage: GeneratedVideoPackage | null;
  voiceVolume: number;
  musicVolume: number;
  onChangeVoiceVolume: (v: number) => void;
  onChangeMusicVolume: (v: number) => void;
  onVideoGenerated: (pkg: GeneratedVideoPackage) => void;
  onUpdateMode: (mode: "3d-animation" | "3d-slideshow") => void;
  onContinue: () => void;
}

export function VideoScreen({
  beats,
  scene,
  videoPackage,
  voiceVolume,
  musicVolume,
  onChangeVoiceVolume,
  onChangeMusicVolume,
  onVideoGenerated,
  onUpdateMode,
  onContinue,
}: VideoScreenProps) {
  const refCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isRegeneratingMusic, setIsRegeneratingMusic] = useState(false);
  const [isPreviewingMusic, setIsPreviewingMusic] = useState(false);
  const musicPreviewCtxRef = useRef<AudioContext | null>(null);
  const musicPreviewSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Render consistent Character Reference Sheet via Three.js
  useEffect(() => {
    const canvas = refCanvasRef.current;
    if (!canvas) return;
    let stage: ThreeFilmStage | null = null;
    try {
      stage = new ThreeFilmStage(canvas);
      stage.setSize(800, 320);
      stage.renderReferenceSheet(scene.style);
    } catch {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#F2EEE6";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#D99A70";
        ctx.beginPath();
        ctx.roundRect(220, 110, 96, 96, 16);
        ctx.fill();
        ctx.fillStyle = "#A4B5A0";
        [430, 520, 610].forEach((cx) => {
          ctx.beginPath();
          ctx.arc(cx, 162, 42, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }
    return () => {
      stage?.dispose();
    };
  }, [scene.style]);

  const stopMusicPreview = () => {
    try {
      musicPreviewSrcRef.current?.stop();
      musicPreviewSrcRef.current?.disconnect();
    } catch {
      // Ignore
    }
    musicPreviewSrcRef.current = null;
    if (
      musicPreviewCtxRef.current &&
      musicPreviewCtxRef.current.state !== "closed"
    ) {
      void musicPreviewCtxRef.current.close().catch(() => undefined);
    }
    musicPreviewCtxRef.current = null;
    setIsPreviewingMusic(false);
  };

  useEffect(() => {
    return () => stopMusicPreview();
  }, []);

  const handleGenerate = async () => {
    stopMusicPreview();
    setIsGenerating(true);
    setErrorMessage(null);
    setProgressPct(5);
    setProgressLabel("Preparing character reference & synthesizing voices...");

    try {
      const pkg = await buildVideoPackage(
        beats,
        scene.style,
        (label, ratio) => {
          setProgressLabel(label);
          setProgressPct(Math.max(8, Math.round(ratio * 100)));
        },
        videoPackage?.musicSeed ?? 1,
        videoPackage?.musicBuffer,
        videoPackage?.musicSourceLabel
      );
      onVideoGenerated(pkg);
      setProgressPct(100);
      setProgressLabel("30-second 3D film ready!");
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Could not assemble the 3D short film."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateMusic = async () => {
    if (!videoPackage) return;
    stopMusicPreview();
    setIsRegeneratingMusic(true);
    try {
      const nextSeed = videoPackage.musicSeed + 1;
      const newBuffer = await generateOriginalSoundtrack(nextSeed, 48000);
      onVideoGenerated({
        ...videoPackage,
        musicBuffer: newBuffer,
        musicSeed: nextSeed,
        musicSourceLabel: `Original Instrumental Score #${nextSeed}`,
      });
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to regenerate soundtrack."
      );
    } finally {
      setIsRegeneratingMusic(false);
    }
  };

  const handleUploadMusic = async (file: File) => {
    if (!videoPackage) return;
    stopMusicPreview();
    setIsRegeneratingMusic(true);
    setErrorMessage(null);
    try {
      const customBuffer = await decodeCustomMusicFile(file);
      onVideoGenerated({
        ...videoPackage,
        musicBuffer: customBuffer,
        musicSourceLabel: `Uploaded: ${file.name}`,
      });
    } catch {
      setErrorMessage(
        "Could not decode the uploaded audio file. Please use MP3, WAV, or OGG."
      );
    } finally {
      setIsRegeneratingMusic(false);
    }
  };

  const handleToggleMusicPreview = () => {
    if (isPreviewingMusic) {
      stopMusicPreview();
      return;
    }
    if (!videoPackage?.musicBuffer) return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    musicPreviewCtxRef.current = ctx;
    const src = ctx.createBufferSource();
    src.buffer = videoPackage.musicBuffer;
    const g = ctx.createGain();
    g.gain.value = Math.max(0.25, musicVolume);
    src.connect(g);
    g.connect(ctx.destination);
    src.onended = () => setIsPreviewingMusic(false);
    src.start(0);
    musicPreviewSrcRef.current = src;
    setIsPreviewingMusic(true);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-[#75726B]">
            Step 4 of 5 · 3D Motion & Sound Production
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#484744] text-balance">
            3D Film & Continuous Score
          </h1>
          <p className="text-sm sm:text-base text-[#66645F] max-w-2xl">
            Assemble all four beats into a continuous 30-second 3D short film
            with consistent ceramic characters, English voice acting, and an
            original emotional soundtrack.
          </p>
        </div>

        <div className="flex items-center gap-3 text-sm text-[#66645F] shrink-0">
          <span>{scene.style}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">1920×1080 · 30.0s</span>
        </div>
      </div>

      {/* Consistent Character Reference Sheet */}
      <div className="bg-white/85 border border-[#D8D2C7] rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base sm:text-lg font-semibold text-[#484744]">
              Consistent Character Reference Sheet
            </h2>
            <p className="text-xs sm:text-sm text-[#66645F]">
              Shared 3D proportions, matte ceramic finish, and minimal facial
              features locked across all 4 beats.
            </p>
          </div>
          <span className="font-mono-tabular text-xs text-[#75726B]">
            Cube #D99A70 · Spheres #A4B5A0
          </span>
        </div>

        <div className="rounded-xl overflow-hidden border border-[#D4CEC2] bg-[#F2EEE6]">
          <canvas
            ref={refCanvasRef}
            width={800}
            height={320}
            className="w-full h-36 sm:h-48 object-cover block"
          />
        </div>
      </div>

      {/* 4-Beat Production Timeline Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {beats.map((b) => (
          <div
            key={b.id}
            className="bg-white/85 border border-[#D8D2C7] rounded-2xl p-3.5 space-y-1"
          >
            <div className="flex items-center justify-between text-xs text-[#75726B]">
              <span>Beat {b.number}</span>
              <span className="font-mono-tabular font-semibold">
                {b.durationSec}s
              </span>
            </div>
            <p className="font-display font-semibold text-[#484744] truncate">
              {b.title}
            </p>
            <p className="text-xs text-[#75726B] font-mono-tabular">
              {b.startSec}s – {b.endSec}s · {b.lines.length}{" "}
              {b.lines.length === 1 ? "line" : "lines"}
            </p>
          </div>
        ))}
      </div>

      {/* Generation Control Card */}
      <div className="bg-white/90 border border-[#D8D2C7] rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-bold text-[#484744]">
              Voice, Score & 3D Scene Assembly
            </h2>
            <p className="text-sm text-[#66645F]">
              Synthesizes expressive English voices, continuous 4-beat piano &
              strings score, foley SFX, and automatic voice ducking.
            </p>
          </div>

          <button
            type="button"
            disabled={isGenerating}
            onClick={handleGenerate}
            className="min-h-[48px] px-6 py-3 rounded-xl bg-[#D99A70] text-white font-semibold text-sm sm:text-base hover:bg-[#C6865B] disabled:opacity-65 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-xs"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Assembling ({progressPct}%)...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>
                  {videoPackage
                    ? "Rebuild 30s 3D Film"
                    : "Generate 30s 3D Film"}
                </span>
              </>
            )}
          </button>
        </div>

        {isGenerating && (
          <div className="space-y-2 pt-1">
            <div className="h-2.5 w-full rounded-full bg-[#EAE4D8] overflow-hidden">
              <div
                className="h-full bg-[#D99A70] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-[#66645F]">{progressLabel}</p>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-xl border border-[#DC8A7E] bg-[#FDF0EE] p-3.5 text-sm text-[#7D2B20]">
            {errorMessage}
          </div>
        )}

        {videoPackage?.ttsErrorNotice && (
          <div className="rounded-xl border border-[#D99A70] bg-[#FAF0E8] p-3.5 flex items-start gap-2.5 text-sm text-[#6E4427]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#C27849]" />
            <div>
              <p className="font-semibold">3D Motion Slideshow Fallback Active</p>
              <p className="text-xs mt-0.5 opacity-90">
                {videoPackage.ttsErrorNotice} Your film preserves the 3D scene
                aesthetic, original music, foley, and synchronized subtitles.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Soundtrack Controls & Live 3D Player */}
      {videoPackage ? (
        <div className="space-y-5">
          {/* Background Music Studio Controls */}
          <div className="bg-white/85 border border-[#D8D2C7] rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-[#6F876B] inline-flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5" />
                  <span>Continuous 30s Instrumental Soundtrack</span>
                </p>
                <p className="text-sm font-medium text-[#484744]">
                  {videoPackage.musicSourceLabel}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleMusicPreview}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#D8D2C7] bg-[#FAF8F4] text-xs sm:text-sm font-medium text-[#484744] hover:bg-[#EFEAE0] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {isPreviewingMusic ? (
                    <>
                      <Square className="w-3.5 h-3.5" />
                      <span>Stop Music</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Preview Music</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isRegeneratingMusic}
                  onClick={handleRegenerateMusic}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#EBF0EA] border border-[#B8C7B4] text-xs sm:text-sm font-semibold text-[#3F533B] hover:bg-[#DFEAE0] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {isRegeneratingMusic ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>Regenerate Music</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUploadMusic(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#D8D2C7] bg-white text-xs sm:text-sm font-medium text-[#484744] hover:bg-[#EFEAE0] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Instrumental</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-[#3F533B] font-medium">
              <CheckCircle2 className="w-4 h-4 text-[#6F876B]" />
              <span>
                30-second 3D film preview ready ({videoPackage.style})
              </span>
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#EAE4D8]">
              <button
                type="button"
                onClick={() => onUpdateMode("3d-animation")}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                  videoPackage.mode === "3d-animation"
                    ? "bg-white text-[#484744] shadow-xs"
                    : "text-[#66645F] hover:text-[#484744]"
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>3D Animation</span>
              </button>
              <button
                type="button"
                onClick={() => onUpdateMode("3d-slideshow")}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                  videoPackage.mode === "3d-slideshow"
                    ? "bg-white text-[#484744] shadow-xs"
                    : "text-[#66645F] hover:text-[#484744]"
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>3D Motion Slideshow</span>
              </button>
            </div>
          </div>

          <StoryPlayer
            videoPackage={videoPackage}
            beats={beats}
            voiceVolume={voiceVolume}
            musicVolume={musicVolume}
            onChangeVoiceVolume={onChangeVoiceVolume}
            onChangeMusicVolume={onChangeMusicVolume}
            showAudioSliders
          />

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onContinue}
              className="w-full sm:w-auto min-h-[50px] px-7 py-3 rounded-xl bg-[#6F876B] text-white text-base font-semibold hover:bg-[#5E745A] active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <span>Go to Final Screening & MP4 Export</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#C5C0B8] bg-[#FAF8F4] p-10 text-center space-y-2">
          <p className="font-display text-lg font-semibold text-[#484744]">
            Ready to assemble your 30-second 3D short film
          </p>
          <p className="text-sm text-[#66645F] max-w-md mx-auto">
            Click “Generate 30s 3D Film” above to lock character references,
            synthesize voices, and compose your continuous instrumental score.
          </p>
        </div>
      )}
    </section>
  );
}
