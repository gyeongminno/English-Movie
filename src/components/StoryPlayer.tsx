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
import type { Beat, GeneratedVideoPackage } from "../types";
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

  const audioCtxRef = useRef<AudioContext | null>(null);
  const voiceGainRef = useRef<GainNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const rafRef = useRef<number | null>(null);
  const playStartPerfRef = useRef<number>(0);
  const playOffsetRef = useRef<number>(0);
  const currentTimeRef = useRef<number>(0);
  const spokenFallbackIdsRef = useRef<Set<string>>(new Set());

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
  }, []);

  // Live gain updates for mute / volume sliders
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = isMuted ? 0 : 1;
    }
    if (voiceGainRef.current) {
      voiceGainRef.current.gain.value = voiceVolume;
    }
    if (
      musicGainRef.current &&
      audioCtxRef.current &&
      audioCtxRef.current.state === "running" &&
      isPlaying
    ) {
      const elapsed = (performance.now() - playStartPerfRef.current) / 1000;
      const offset = playOffsetRef.current + elapsed;
      buildDuckingEnvelope(
        musicGainRef.current.gain,
        musicVolume,
        videoPackage.timedLines,
        audioCtxRef.current.currentTime,
        offset
      );
    }
  }, [isMuted, voiceVolume, musicVolume, isPlaying, videoPackage.timedLines]);

  const scheduleAudioFrom = useCallback(
    (offsetSec: number) => {
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
        void ctx.resume();
      }

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

      // 1. Schedule continuous 30s two-track instrumental soundtrack with automatic voice ducking
      if (videoPackage.musicBuffer && musicGainRef.current) {
        const mSrc = ctx.createBufferSource();
        mSrc.buffer = videoPackage.musicBuffer;
        buildDuckingEnvelope(
          musicGainRef.current.gain,
          musicVolume,
          videoPackage.timedLines,
          nowCtx,
          offsetSec
        );
        mSrc.connect(musicGainRef.current);
        mSrc.start(nowCtx, Math.max(0, Math.min(29.9, offsetSec)));
        activeSourcesRef.current.push(mSrc);
      }

      // 2. Schedule spoken English dialogue lines
      if (voiceGainRef.current) {
        for (const line of videoPackage.timedLines) {
          if (!line.audioBuffer) continue;
          if (line.endSec <= offsetSec) continue;

          const src = ctx.createBufferSource();
          src.buffer = line.audioBuffer;
          const slotDur = Math.max(0.5, line.endSec - line.startSec);
          if (line.audioBuffer.duration > slotDur) {
            src.playbackRate.value = Math.min(
              1.25,
              line.audioBuffer.duration / slotDur
            );
          }
          src.connect(voiceGainRef.current);

          if (offsetSec <= line.startSec) {
            src.start(nowCtx + (line.startSec - offsetSec));
          } else {
            const intoLine = (offsetSec - line.startSec) * src.playbackRate.value;
            if (intoLine < line.audioBuffer.duration) {
              src.start(nowCtx, intoLine);
            }
          }
          activeSourcesRef.current.push(src);
        }
      }
    },
    [
      isMuted,
      musicVolume,
      stopAudio,
      videoPackage.musicBuffer,
      videoPackage.timedLines,
      voiceVolume,
    ]
  );

  const pausePlayback = useCallback(() => {
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
      const clamped = Math.max(0, Math.min(29.95, startSec));
      playOffsetRef.current = clamped;
      playStartPerfRef.current = performance.now();
      currentTimeRef.current = clamped;
      setCurrentTime(clamped);
      setIsPlaying(true);

      scheduleAudioFrom(clamped);

      const step = () => {
        const elapsed = (performance.now() - playStartPerfRef.current) / 1000;
        const nextT = playOffsetRef.current + elapsed;

        if (nextT >= 30) {
          currentTimeRef.current = 30;
          setCurrentTime(30);
          drawAt(30);
          pausePlayback();
          return;
        }

        if (
          !isMuted &&
          voiceVolume > 0.05 &&
          typeof window !== "undefined" &&
          "speechSynthesis" in window
        ) {
          for (const line of videoPkgRef.current.timedLines) {
            if (
              !line.audioBuffer &&
              nextT >= line.startSec &&
              nextT <= line.startSec + 0.35 &&
              !spokenFallbackIdsRef.current.has(line.lineId)
            ) {
              spokenFallbackIdsRef.current.add(line.lineId);
              const utter = new SpeechSynthesisUtterance(line.text);
              utter.lang = "en-US";
              utter.rate = 0.92;
              utter.volume = Math.min(1, voiceVolume);
              utter.pitch = line.speaker === "Pencil" ? 1.12 : 0.94;
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

  const activeSub = getActiveSubtitleAt(currentTime, videoPackage.timedLines);
  const currentBeat =
    beats.find(
      (b) => currentTime >= b.startSec && currentTime < b.endSec
    ) ?? beats[beats.length - 1];

  const creditOpacity =
    currentTime >= 26.8 ? Math.min(1, (currentTime - 26.8) / 1.1) : 0;

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

        {/* Beat Markers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {beats.map((b) => {
            const active = currentBeat?.number === b.number;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => handleSeek(b.startSec)}
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
                    {b.startSec}–{b.endSec}s
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
