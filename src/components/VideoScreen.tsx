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

type PreviewTarget = "combined" | "track1" | "track2";

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
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null);
  const musicPreviewCtxRef = useRef<AudioContext | null>(null);
  const musicPreviewSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Render consistent Yellow Pencil & Cobalt-Blue Eraser Reference Sheet via Three.js
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
        ctx.fillStyle = "#FAF7EF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Yellow Pencil (2D fallback reference, eyes only — no mouth/eyebrows/arms)
        ctx.save();
        ctx.translate(250, 165);
        ctx.rotate(-0.18);
        ctx.fillStyle = "#F5C518";
        ctx.fillRect(-16, -90, 32, 132);
        ctx.fillStyle = "#E8C39E";
        ctx.beginPath();
        ctx.moveTo(-16, 42);
        ctx.lineTo(16, 42);
        ctx.lineTo(0, 82);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#242424";
        ctx.beginPath();
        ctx.moveTo(-6, 67);
        ctx.lineTo(6, 67);
        ctx.lineTo(0, 82);
        ctx.closePath();
        ctx.fill();
        // Eyes only
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(-6, -24, 4.5, 0, Math.PI * 2);
        ctx.arc(6, -24, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#242424";
        ctx.beginPath();
        ctx.arc(-5.5, -24, 2.3, 0, Math.PI * 2);
        ctx.arc(6.5, -24, 2.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Cobalt-Blue Eraser (eyes only — no sleeve, no mouth/eyebrows/arms)
        ctx.fillStyle = "#2449D8";
        ctx.beginPath();
        ctx.roundRect(455, 118, 128, 86, 16);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(505, 152, 6, 0, Math.PI * 2);
        ctx.arc(533, 152, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#242424";
        ctx.beginPath();
        ctx.arc(504, 152, 3, 0, Math.PI * 2);
        ctx.arc(532, 152, 3, 0, Math.PI * 2);
        ctx.fill();
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
    setPreviewTarget(null);
  };

  useEffect(() => {
    return () => stopMusicPreview();
  }, []);

  const handleGenerate = async () => {
    stopMusicPreview();
    setIsGenerating(true);
    setErrorMessage(null);
    setProgressPct(5);
    setProgressLabel("Preparing Pencil & Eraser reference & synthesizing voices...");

    try {
      const pkg = await buildVideoPackage(
        beats,
        scene.style,
        (label, ratio) => {
          setProgressLabel(label);
          setProgressPct(Math.max(8, Math.round(ratio * 100)));
        },
        videoPackage?.musicSeed ?? 1,
        videoPackage
          ? {
              combinedBuffer: videoPackage.musicBuffer,
              track1Buffer: videoPackage.track1Buffer,
              track2Buffer: videoPackage.track2Buffer,
              label: videoPackage.musicSourceLabel,
            }
          : undefined
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
    setErrorMessage(null);
    try {
      const nextSeed = videoPackage.musicSeed + 1;
      const musicPack = await generateOriginalSoundtrack(nextSeed, 48000);
      onVideoGenerated({
        ...videoPackage,
        musicBuffer: musicPack.combinedBuffer,
        track1Buffer: musicPack.track1Buffer,
        track2Buffer: musicPack.track2Buffer,
        musicSeed: nextSeed,
        musicSourceLabel: `Original Two-Track Score #${nextSeed} (Track 1 + Track 2)`,
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
        track1Buffer: customBuffer,
        track2Buffer: customBuffer,
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

  const handleToggleMusicPreview = (target: PreviewTarget) => {
    if (previewTarget === target) {
      stopMusicPreview();
      return;
    }
    stopMusicPreview();
    if (!videoPackage) return;

    const buffer =
      target === "track1"
        ? videoPackage.track1Buffer
        : target === "track2"
          ? videoPackage.track2Buffer
          : videoPackage.musicBuffer;
    if (!buffer) return;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    musicPreviewCtxRef.current = ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = Math.max(0.28, musicVolume);
    src.connect(g);
    g.connect(ctx.destination);
    src.onended = () => setPreviewTarget(null);
    src.start(0);
    musicPreviewSrcRef.current = src;
    setPreviewTarget(target);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-[#6B6760]">
            Step 4 of 5 · 3D Motion & Two-Track Score
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#242424] text-balance">
            3D Film & Two-Track Soundtrack
          </h1>
          <p className="text-sm sm:text-base text-[#524F4A] max-w-2xl">
            Assemble all four beats into a continuous 30-second 3D short film
            with the vivid yellow pencil, the cobalt-blue eraser, English
            voices, and two crossfaded instrumental tracks.
          </p>
        </div>

        <div className="flex items-center gap-3 text-sm text-[#524F4A] shrink-0">
          <span>{scene.style}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">1920×1080 · 30.0s</span>
        </div>
      </div>

      {/* Consistent Character Reference Sheet */}
      <div className="bg-white/90 border border-[#DCD7CE] rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#242424]">
              Consistent Character Reference Sheet
            </h2>
            <p className="text-xs sm:text-sm text-[#524F4A]">
              Shared 3D proportions, slightly glossy painted yellow pencil wood,
              and matte cobalt-blue rubber finish locked across all 4 beats.
            </p>
          </div>
          <span className="font-mono-tabular text-xs text-[#6B6760]">
            Pencil #F5C518 · Eraser #2449D8 · Graphite #242424 · Paper #FAF7EF
          </span>
        </div>

        <div className="rounded-xl overflow-hidden border border-[#DCD7CE] bg-[#FAF7EF]">
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
            className="bg-white/90 border border-[#DCD7CE] rounded-2xl p-3.5 space-y-1"
          >
            <div className="flex items-center justify-between text-xs text-[#6B6760]">
              <span>Beat {b.number}</span>
              <span className="font-mono-tabular font-semibold">
                {b.durationSec}s
              </span>
            </div>
            <p className="font-display font-semibold text-[#242424] truncate">
              {b.title}
            </p>
            <p className="text-xs text-[#6B6760] font-mono-tabular">
              {b.startSec}s – {b.endSec}s ·{" "}
              {b.number <= 2 ? "Music 1" : "Music 2"}
            </p>
          </div>
        ))}
      </div>

      {/* Generation Control Card */}
      <div className="bg-white/95 border border-[#DCD7CE] rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-bold text-[#242424]">
              Voice, Two-Track Score & 3D Scene Assembly
            </h2>
            <p className="text-sm text-[#524F4A]">
              Synthesizes distinct Pencil & Eraser voices, Background Music 1
              (0–15s) + Background Music 2 (15–30s) with smooth crossfade,
              graphite/eraser foley SFX, and automatic voice ducking.
            </p>
          </div>

          <button
            type="button"
            disabled={isGenerating}
            onClick={handleGenerate}
            className="min-h-[48px] px-6 py-3 rounded-xl bg-[#2449D8] text-white font-semibold text-sm sm:text-base hover:bg-[#1D3CB8] disabled:opacity-65 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-xs"
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
            <div className="h-2.5 w-full rounded-full bg-[#EFEAE0] overflow-hidden">
              <div
                className="h-full bg-[#2449D8] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-[#524F4A]">{progressLabel}</p>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-xl border border-[#2449D8] bg-[#EEF2FF] p-3.5 text-sm text-[#1D3CB8]">
            {errorMessage}
          </div>
        )}

        {videoPackage?.ttsErrorNotice && (
          <div className="rounded-xl border border-[#F5C518] bg-[#FFFBEB] p-3.5 flex items-start gap-2.5 text-sm text-[#242424]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#B68600]" />
            <div>
              <p className="font-semibold">3D Motion Slideshow Fallback Active</p>
              <p className="text-xs mt-0.5 text-[#524F4A]">
                {videoPackage.ttsErrorNotice} Your film preserves the 3D scene
                aesthetic, two-track music, foley, and synchronized subtitles.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Soundtrack Controls & Live 3D Player */}
      {videoPackage ? (
        <div className="space-y-5">
          {/* Two-Track Background Music Studio Controls */}
          <div className="bg-white/90 border border-[#DCD7CE] rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-[#242424] inline-flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-[#2449D8]" />
                  <span>Two-Track 30s Instrumental Score (Crossfade at 15s)</span>
                </p>
                <p className="text-sm font-medium text-[#524F4A]">
                  {videoPackage.musicSourceLabel}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleMusicPreview("combined")}
                  className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                    previewTarget === "combined"
                      ? "bg-[#242424] border-[#242424] text-white"
                      : "border-[#DCD7CE] bg-[#FAF7EF] text-[#242424] hover:bg-[#EFEAE0]"
                  }`}
                >
                  {previewTarget === "combined" ? (
                    <>
                      <Square className="w-3.5 h-3.5" />
                      <span>Stop Full Score</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Preview Full 30s</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isRegeneratingMusic}
                  onClick={handleRegenerateMusic}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#FFFBEB] border border-[#F5C518] text-xs sm:text-sm font-semibold text-[#242424] hover:bg-[#FFF3BF] inline-flex items-center gap-1.5 cursor-pointer"
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
                  className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#DCD7CE] bg-white text-xs sm:text-sm font-medium text-[#242424] hover:bg-[#EFEAE0] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Instrumental</span>
                </button>
              </div>
            </div>

            {/* Track 1 & Track 2 Individual Preview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#EFEAE0]">
              <div className="rounded-xl border border-[#E5E0D6] bg-[#FAF7EF] p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#242424]">
                    Background Music 1 — Curiosity · 0–15s
                  </p>
                  <p className="text-xs text-[#524F4A] truncate">
                    C4, E4, D4, G4 · Soft piano &amp; subtle pizzicato · 90→120 BPM
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleMusicPreview("track1")}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-semibold shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
                    previewTarget === "track1"
                      ? "bg-[#242424] border-[#242424] text-white"
                      : "bg-white border-[#DCD7CE] text-[#242424] hover:bg-[#EFEAE0]"
                  }`}
                >
                  {previewTarget === "track1" ? (
                    <>
                      <Square className="w-3 h-3" />
                      <span>Stop</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      <span>Listen</span>
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-xl border border-[#E5E0D6] bg-[#FAF7EF] p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#242424]">
                    Background Music 2 — Blooming · 15–30s
                  </p>
                  <p className="text-xs text-[#524F4A] truncate">
                    C4, E4, G4, C5 · Soft piano, xylophone &amp; bells · ~75 BPM
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleMusicPreview("track2")}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-semibold shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
                    previewTarget === "track2"
                      ? "bg-[#2449D8] border-[#2449D8] text-white"
                      : "bg-white border-[#DCD7CE] text-[#242424] hover:bg-[#EFEAE0]"
                  }`}
                >
                  {previewTarget === "track2" ? (
                    <>
                      <Square className="w-3 h-3" />
                      <span>Stop</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      <span>Listen</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-[#242424] font-medium">
              <CheckCircle2 className="w-4 h-4 text-[#2449D8]" />
              <span>
                30-second 3D film preview ready ({videoPackage.style})
              </span>
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#EFEAE0]">
              <button
                type="button"
                onClick={() => onUpdateMode("3d-animation")}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                  videoPackage.mode === "3d-animation"
                    ? "bg-white text-[#242424] shadow-xs"
                    : "text-[#524F4A] hover:text-[#242424]"
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
                    ? "bg-white text-[#242424] shadow-xs"
                    : "text-[#524F4A] hover:text-[#242424]"
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
              className="w-full sm:w-auto min-h-[50px] px-7 py-3 rounded-xl bg-[#242424] text-[#FAF7EF] text-base font-semibold hover:bg-[#363532] active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <span>Go to Final Screening & MP4 Export</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#B8B5AF] bg-white/60 p-10 text-center space-y-2">
          <p className="font-display text-lg font-semibold text-[#242424]">
            Ready to assemble your 30-second 3D short film
          </p>
          <p className="text-sm text-[#524F4A] max-w-md mx-auto">
            Click “Generate 30s 3D Film” above to lock character references,
            synthesize Pencil & Eraser voices, and compose both instrumental
            tracks.
          </p>
        </div>
      )}
    </section>
  );
}
