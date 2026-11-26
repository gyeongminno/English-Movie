import {
  Languages,
  Music,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FILM_CREDIT_TEXT } from "../data/defaults";
import type { Beat, GeneratedVideoPackage, SpeakerRole } from "../types";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  renderFrame as render2DFallback,
} from "../utils/canvasRenderer";
import { buildDuckingEnvelope } from "../utils/soundtrackEngine";
import { ThreeFilmStage } from "../utils/threeRenderer";
import { getActiveSubtitleAt } from "../utils/videoEngine";

interface StoryPlayerProps {
  videoPackage: GeneratedVideoPackage;
  beats: Beat[];
  voiceVolume: number;
  musicVolume: number;
  onChangeVoiceVolume?: (v: number) => void;
  onChangeMusicVolume?: (v: number) => void;
  showAudioSliders?: boolean;
  autoPlay?: boolean;
}

export function StoryPlayer({
  videoPackage,
  beats,
  voiceVolume,
  musicVolume,
  onChangeVoiceVolume,
  onChangeMusicVolume,
  showAudioSliders = false,
  autoPlay = false,
}: StoryPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<ThreeFilmStage | null>(null);
  const use2DFallbackRef = useRef<boolean>(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showKorean, setShowKorean] = useState(false);

  const [liveFallbackSub, setLiveFallbackSub] = useState<{
    lines: string[];
    korean: string;
    speaker: SpeakerRole;
  } | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const voiceGainRef = useRef<GainNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const rafRef = useRef<number | null>(null);
  const playbackSessionRef = useRef<number>(0);
  const audioCtxAnchorRef = useRef<number | null>(null);
  const playStartPerfRef = useRef<number>(0);
  const playOffsetRef = useRef<number>(0);
  const currentTimeRef = useRef<number>(0);
  const spokenFallbackIdsRef = useRef<Set<string>>(new Set());
  const speechSynthActiveRef = useRef<boolean>(false);

  const videoPkgRef = useRef(videoPackage);
  videoPkgRef.current = videoPackage;

  const drawAt = useCallback((timeSec: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pkg = videoPkgRef.current;

    if (!use2DFallbackRef.current && stageRef.current) {
      stageRef.current.renderAtTime({
        timeSec,
        style: pkg.style,
        mode: pkg.mode,
        timedLines: pkg.timedLines,
        timelineMarkers: pkg.timelineMarkers,
      });
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    render2DFallback(ctx, {
      timeSec,
      style: pkg.style,
      mode: pkg.mode === "3d-slideshow" ? "slideshow" : "animation",
      timedLines: pkg.timedLines,
      timedSegments: pkg.timedSegments,
      timelineMarkers: pkg.timelineMarkers,
      drawSubtitles: false,
    });
  }, []);

  // Initialize isolated Three.js WebGL stage once (with graceful WebGL fallback)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onContextLost = (e: Event) => {
      e.preventDefault();
      use2DFallbackRef.current = true;
    };
    const onContextRestored = () => {
      use2DFallbackRef.current = false;
      drawAt(currentTimeRef.current);
    };

    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);

    try {
      const stage = new ThreeFilmStage(canvas);
      stage.setSize(1280, 720);
      stageRef.current = stage;
      use2DFallbackRef.current = false;
    } catch {
      use2DFallbackRef.current = true;
    }

    drawAt(currentTimeRef.current);

    return () => {
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      stageRef.current?.dispose();
      stageRef.current = null;
    };
  }, [drawAt]);

  // Redraw when style/mode/package updates while paused
  useEffect(() => {
    drawAt(currentTimeRef.current);
  }, [videoPackage, drawAt]);

  const stopAudio = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // Ignore already stopped sources
      }
    }
    activeSourcesRef.current = [];
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    speechSynthActiveRef.current = false;
    setLiveFallbackSub(null);
  }, []);

  // Live gain updates for mute / volume sliders
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = isMuted ? 0 : 1;
    }
    if (voiceGainRef.current) {
      voiceGainRef.current.gain.value = voiceVolume;
    }
    const ctx = audioCtxRef.current;
    if (
      musicGainRef.current &&
      ctx &&
      ctx.state === "running" &&
      isPlaying &&
      audioCtxAnchorRef.current !== null
    ) {
      const elapsed = Math.max(0, ctx.currentTime - audioCtxAnchorRef.current);
      const offset = playOffsetRef.current + elapsed;
      buildDuckingEnvelope(
        musicGainRef.current.gain,
        musicVolume,
        videoPackage.timedLines,
        ctx.currentTime,
        offset
      );
    }
  }, [isMuted, voiceVolume, musicVolume, isPlaying, videoPackage.timedLines]);

  const scheduleAudioFrom = useCallback(
    async (offsetSec: number, sessionId: number) => {
      stopAudio();
      spokenFallbackIdsRef.current.clear();

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;

      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        await ctx.resume().catch(() => undefined);
      }

      if (sessionId !== playbackSessionRef.current) return;

      if (!masterGainRef.current || masterGainRef.current.context !== ctx) {
        const master = ctx.createGain();
        master.gain.value = isMuted ? 0 : 1;
        master.connect(ctx.destination);
        masterGainRef.current = master;

        const vGain = ctx.createGain();
        vGain.gain.value = voiceVolume;
        vGain.connect(master);
        voiceGainRef.current = vGain;

        const mGain = ctx.createGain();
        mGain.gain.value = musicVolume;
        mGain.connect(master);
        musicGainRef.current = mGain;
      }

      const nowCtx = ctx.currentTime;
      audioCtxAnchorRef.current = nowCtx;
      playStartPerfRef.current = performance.now();

      const pkg = videoPkgRef.current;

      // 1. Schedule continuous 30s two-track instrumental soundtrack with automatic voice ducking
      if (pkg.musicBuffer && musicGainRef.current) {
        const mSrc = ctx.createBufferSource();
        mSrc.buffer = pkg.musicBuffer;
        buildDuckingEnvelope(
          musicGainRef.current.gain,
          musicVolume,
          pkg.timedLines,
          nowCtx,
          offsetSec
        );
        mSrc.connect(musicGainRef.current);
        mSrc.start(nowCtx, Math.max(0, Math.min(29.9, offsetSec)));
        mSrc.stop(nowCtx + Math.max(0.05, 30 - offsetSec));
        activeSourcesRef.current.push(mSrc);
      }

      // 2. Schedule spoken English dialogue lines using exact measured speech trim boundaries
      if (voiceGainRef.current) {
        for (const line of pkg.timedLines) {
          if (!line.audioBuffer) continue;
          if (line.endSec <= offsetSec) continue;

          const src = ctx.createBufferSource();
          src.buffer = line.audioBuffer;
          const rate = line.playbackRate || 1;
          src.playbackRate.value = rate;

          const trimStart = Math.max(0, line.trimStartSec ?? 0);
          const trimEnd = Math.min(
            line.audioBuffer.duration,
            line.trimEndSec || line.audioBuffer.duration
          );
          const sourceSpan = Math.max(0.1, trimEnd - trimStart);
          const totalOutputDur = sourceSpan / rate;

          src.connect(voiceGainRef.current);

          if (offsetSec <= line.startSec) {
            const startAt = nowCtx + (line.startSec - offsetSec);
            src.start(startAt, trimStart);
            src.stop(startAt + totalOutputDur);
          } else {
            const elapsedOut = offsetSec - line.startSec;
            const intoSource = elapsedOut * rate;
            const remainingSource = trimEnd - (trimStart + intoSource);
            if (remainingSource > 0.03) {
              src.start(nowCtx, trimStart + intoSource);
              src.stop(nowCtx + remainingSource / rate);
            }
          }
          activeSourcesRef.current.push(src);
        }
      }
    },
    [isMuted, musicVolume, stopAudio, voiceVolume]
  );

  const pausePlayback = useCallback(() => {
    playbackSessionRef.current += 1;
    audioCtxAnchorRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    stopAudio();
    setIsPlaying(false);
  }, [stopAudio]);

  const startPlaybackFrom = useCallback(
    (startSec: number) => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const sessionId = ++playbackSessionRef.current;
      const clamped = Math.max(0, Math.min(29.95, startSec));
      playOffsetRef.current = clamped;
      playStartPerfRef.current = performance.now();
      audioCtxAnchorRef.current = null;
      currentTimeRef.current = clamped;
      setCurrentTime(clamped);
      setIsPlaying(true);
      drawAt(clamped);

      void scheduleAudioFrom(clamped, sessionId);

      const resolveLockedFallbackVoices = () => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
          return { pencilVoice: null, eraserVoice: null };
        }
        const allVoices = window.speechSynthesis
          .getVoices()
          .filter((v) => v.lang.toLowerCase().startsWith("en"));
        const pencilVoice =
          allVoices.find((v) => v.lang === "en-US") || allVoices[0] || null;
        const eraserVoice =
          allVoices.find(
            (v) =>
              v.lang === "en-US" &&
              pencilVoice &&
              v.name !== pencilVoice.name
          ) || pencilVoice;
        return { pencilVoice, eraserVoice };
      };

      const step = () => {
        if (sessionId !== playbackSessionRef.current) return;

        const ctx = audioCtxRef.current;
        const elapsed =
          ctx &&
          ctx.state === "running" &&
          audioCtxAnchorRef.current !== null
            ? Math.max(0, ctx.currentTime - audioCtxAnchorRef.current)
            : (performance.now() - playStartPerfRef.current) / 1000;
        const nextT = playOffsetRef.current + elapsed;

        if (nextT >= 30) {
          currentTimeRef.current = 30;
          setCurrentTime(30);
          drawAt(30);
          pausePlayback();
          return;
        }

        // Fallback phrase-by-phrase speechSynthesis synced strictly to displayed subtitle
        if (
          !isMuted &&
          voiceVolume > 0.05 &&
          typeof window !== "undefined" &&
          "speechSynthesis" in window
        ) {
          const pkg = videoPkgRef.current;
          for (const seg of pkg.timedSegments || []) {
            const parentLine = pkg.timedLines.find(
              (l) => l.lineId === seg.lineId
            );
            if (parentLine?.audioBuffer) continue;
            if (
              nextT >= seg.startSec &&
              nextT <= Math.min(seg.endSec, seg.startSec + 0.35) &&
              !spokenFallbackIdsRef.current.has(seg.id)
            ) {
              spokenFallbackIdsRef.current.add(seg.id);
              const { pencilVoice, eraserVoice } =
                resolveLockedFallbackVoices();
              const utter = new SpeechSynthesisUtterance(seg.text);
              utter.lang = "en-US";
              utter.volume = Math.min(1, voiceVolume);
              const isPencil =
                parentLine?.voiceId === "PENCIL_VOICE" ||
                seg.speaker === "Pencil";
              if (isPencil) {
                if (pencilVoice) utter.voice = pencilVoice;
                utter.pitch = 1.15;
                utter.rate = 0.98;
              } else {
                if (eraserVoice) utter.voice = eraserVoice;
                utter.pitch = 0.85;
                utter.rate = 0.94;
              }
              utter.onstart = () => {
                if (sessionId !== playbackSessionRef.current) return;
                speechSynthActiveRef.current = true;
                setLiveFallbackSub({
                  lines: seg.displayLines,
                  korean: seg.koreanTranslation,
                  speaker: seg.speaker,
                });
              };
              utter.onend = () => {
                if (sessionId !== playbackSessionRef.current) return;
                setLiveFallbackSub((prev) =>
                  prev &&
                  prev.lines.join("\n") === seg.displayLines.join("\n")
                    ? null
                    : prev
                );
              };
              utter.onerror = () => {
                if (sessionId !== playbackSessionRef.current) return;
                setLiveFallbackSub(null);
              };
              window.speechSynthesis.speak(utter);
            }
          }
        }

        currentTimeRef.current = nextT;
        setCurrentTime(nextT);
        drawAt(nextT);
        rafRef.current = requestAnimationFrame(step);
      };

      rafRef.current = requestAnimationFrame(step);
    },
    [drawAt, isMuted, pausePlayback, scheduleAudioFrom, voiceVolume]
  );

  useEffect(() => {
    if (autoPlay) {
      startPlaybackFrom(0);
    }
    return () => {
      playbackSessionRef.current += 1;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      stopAudio();
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        void audioCtxRef.current.close().catch(() => undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTogglePlay = () => {
    if (isPlaying) {
      pausePlayback();
    } else {
      startPlaybackFrom(currentTime >= 29.8 ? 0 : currentTime);
    }
  };

  const handleReplay = () => {
    startPlaybackFrom(0);
  };

  const handleSeek = (nextSec: number) => {
    const clamped = Math.max(0, Math.min(30, nextSec));
    currentTimeRef.current = clamped;
    setCurrentTime(clamped);
    drawAt(clamped);
    if (isPlaying) {
      startPlaybackFrom(clamped);
    } else {
      stopAudio();
    }
  };

  const markers = videoPackage.timelineMarkers;
  const timedSub = getActiveSubtitleAt(
    currentTime,
    videoPackage.timedLines,
    videoPackage.timedSegments
  );
  const usingSpeechSynthFallback =
    isPlaying &&
    !isMuted &&
    voiceVolume > 0.05 &&
    videoPackage.timedLines.every((l) => !l.audioBuffer) &&
    speechSynthActiveRef.current;

  const activeSub = usingSpeechSynthFallback ? liveFallbackSub : timedSub;

  const beatBounds = [
    { start: 0, end: markers.beat2StartSec },
    { start: markers.beat2StartSec, end: markers.beat3StartSec },
    { start: markers.beat3StartSec, end: markers.beat4StartSec },
    { start: markers.beat4StartSec, end: 30 },
  ];
  const currentBeat =
    beats.find((b) => {
      const bound = beatBounds[b.number - 1];
      if (!bound) return false;
      return (
        currentTime >= bound.start &&
        (b.number === 4 ? currentTime <= 30 : currentTime < bound.end)
      );
    }) ?? beats[beats.length - 1];

  const creditStart = markers?.creditStartSec ?? 26.8;
  const creditOpacity =
    currentTime >= creditStart
      ? Math.min(1, (currentTime - creditStart) / 1.1)
      : 0;

  return (
    <div className="space-y-4">
      {/* 16:9 3D Viewport + Separate Subtitle & Minimalist Credit Overlays */}
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-[#DCD7CE] bg-[#FAF7EF] shadow-sm select-none">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full block"
        />

        {/* End Credit Overlay (26.8s–30.0s, never extends past 30s) */}
        {creditOpacity > 0.01 && (
          <div
            style={{ opacity: creditOpacity }}
            className="pointer-events-none absolute inset-x-0 top-[7%] text-center px-4"
          >
            <p className="font-display text-xs sm:text-base md:text-lg font-medium tracking-wide text-[#242424]">
              {FILM_CREDIT_TEXT}
            </p>
          </div>
        )}

        {/* Separate Subtitle Overlay (White bold sans-serif, subtle graphite outline, max 2 lines) */}
        {activeSub && activeSub.lines.length > 0 && (
          <div
            aria-live="polite"
            className="pointer-events-none absolute inset-x-0 bottom-[5%] px-4 sm:px-10 flex flex-col items-center text-center gap-1"
          >
            <div className="flex flex-col items-center">
              {activeSub.lines.slice(0, 2).map((line, idx) => (
                <p
                  key={idx}
                  className="text-white font-bold text-sm sm:text-xl md:text-2xl leading-snug tracking-tight max-w-3xl"
                  style={{
                    textShadow:
                      "-1.5px -1.5px 0 rgba(36,36,36,0.92), 1.5px -1.5px 0 rgba(36,36,36,0.92), -1.5px 1.5px 0 rgba(36,36,36,0.92), 1.5px 1.5px 0 rgba(36,36,36,0.92), 0 2px 6px rgba(0,0,0,0.45)",
                  }}
                >
                  {line}
                </p>
              ))}
            </div>

            {showKorean && activeSub.korean && (
              <p className="px-3 py-0.5 rounded-md bg-[#242424]/85 text-[#FAF7EF] text-xs sm:text-sm font-medium max-w-2xl">
                {activeSub.korean}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Playback Controls, Beat Timeline, Korean Subtitle Toggle & Audio Mix */}
      <div className="bg-white/90 border border-[#DCD7CE] rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3">
          <input
            type="range"
            aria-label="Film timeline scrubber"
            min={0}
            max={30}
            step={0.05}
            value={currentTime}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            className="w-full accent-[#2449D8] cursor-pointer h-2"
          />
          <span className="font-mono-tabular text-xs sm:text-sm font-medium text-[#242424] whitespace-nowrap shrink-0">
            {currentTime.toFixed(1)}s / 30.0s
          </span>
        </div>

        {/* Beat Markers (synced to master audio timeline) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {beats.map((b) => {
            const active = currentBeat?.number === b.number;
            const bound = beatBounds[b.number - 1] ?? {
              start: b.startSec,
              end: b.endSec,
            };
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => handleSeek(bound.start)}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-left text-xs transition-colors border cursor-pointer ${
                  active
                    ? "bg-[#FFFBEB] border-[#F5C518] text-[#242424] font-semibold ring-1 ring-[#F5C518]"
                    : "bg-[#FAF7EF] border-[#E5E0D6] text-[#524F4A] hover:bg-[#EFEAE0]"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate">
                    Beat {b.number}: {b.title}
                  </span>
                  <span className="font-mono-tabular text-[11px] opacity-80 shrink-0">
                    {bound.start.toFixed(1)}–{bound.end.toFixed(1)}s
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Transport & Subtitle Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleTogglePlay}
              className="min-h-[48px] px-6 py-2.5 rounded-xl bg-[#2449D8] text-white font-semibold text-sm sm:text-base hover:bg-[#1D3CB8] active:scale-[0.98] transition-all inline-flex items-center gap-2 cursor-pointer shadow-xs"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-5 h-5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  <span>{currentTime >= 29.8 ? "Play Again" : "Play Film"}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleReplay}
              className="min-h-[48px] px-4 py-2.5 rounded-xl bg-[#EFEAE0] text-[#242424] font-semibold text-sm hover:bg-[#E4DDD0] active:scale-[0.98] transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Replay</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowKorean((v) => !v)}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                showKorean
                  ? "bg-[#242424] border-[#242424] text-[#FAF7EF]"
                  : "bg-[#FAF7EF] border-[#DCD7CE] text-[#524F4A] hover:bg-[#EFEAE0]"
              }`}
            >
              <Languages className="w-4 h-4" />
              <span>{showKorean ? "Korean Subs: On" : "Korean Subs: Off"}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMuted((m) => !m)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DCD7CE] bg-[#FAF7EF] text-[#242424] text-xs sm:text-sm font-medium hover:bg-[#EFEAE0] inline-flex items-center gap-1.5 cursor-pointer"
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-4 h-4" />
                  <span>Muted</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  <span>Audio On</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Independent Voice & Background Music Mix Sliders */}
        {showAudioSliders && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[#EAE4D8]">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-[#524F4A]">
                <span className="inline-flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-[#2449D8]" />
                  <span>English Voice Volume</span>
                </span>
                <span className="font-mono-tabular">
                  {Math.round(voiceVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                aria-label="English voice volume"
                min={0}
                max={1.2}
                step={0.05}
                value={voiceVolume}
                onChange={(e) =>
                  onChangeVoiceVolume?.(parseFloat(e.target.value))
                }
                className="w-full accent-[#2449D8] cursor-pointer h-2"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-[#524F4A]">
                <span className="inline-flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-[#242424]" />
                  <span>Background Music Volume (Auto-Ducks)</span>
                </span>
                <span className="font-mono-tabular">
                  {Math.round(musicVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                aria-label="Background music volume"
                min={0}
                max={1.0}
                step={0.05}
                value={musicVolume}
                onChange={(e) =>
                  onChangeMusicVolume?.(parseFloat(e.target.value))
                }
                className="w-full accent-[#242424] cursor-pointer h-2"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
