import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import { FILM_CREDIT_TEXT, PALETTE, splitSubtitleSegments } from "../data/defaults";
import type {
  AnimationStyle,
  Beat,
  GeneratedVideoPackage,
  SpeakerRole,
  TimedLine,
} from "../types";
import { renderFrame as render2DFallbackFrame } from "./canvasRenderer";
import {
  buildDuckingEnvelope,
  generateOriginalSoundtrack,
} from "./soundtrackEngine";
import { ThreeFilmStage } from "./threeRenderer";

function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function synthesizeLineAudio(
  text: string,
  speaker: SpeakerRole,
  beatNumber: number,
  audioCtx: AudioContext
): Promise<{ buffer: AudioBuffer | null; fallbackNotice?: string }> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, speaker, beatNumber }),
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
  return { buffer: await audioCtx.decodeAudioData(wavBuffer) };
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

async function buildBeatTimedLines(
  beat: Beat,
  audioCtx: AudioContext,
  allowTts: boolean
): Promise<{ timedLines: TimedLine[]; ttsError?: string }> {
  const koreanChunks = splitKoreanTranslations(beat);
  const decodedBuffers: Array<{ buffer: AudioBuffer | null; estDuration: number }> = [];
  let ttsError: string | undefined;
  let ttsBroken = !allowTts;

  for (const line of beat.lines) {
    let buffer: AudioBuffer | null = null;
    if (!ttsBroken) {
      try {
        const res = await synthesizeLineAudio(
          line.text,
          line.speaker,
          beat.number,
          audioCtx
        );
        buffer = res.buffer;
        if (!buffer && res.fallbackNotice) {
          ttsBroken = true;
          ttsError = res.fallbackNotice;
        }
      } catch (err) {
        ttsBroken = true;
        ttsError =
          err instanceof Error
            ? err.message
            : "Voice service unavailable; timed 3D motion fallback active.";
      }
    }

    const wordCount = line.text.trim().split(/\s+/).filter(Boolean).length;
    const fallbackDur = Math.max(1.4, wordCount * 0.42);
    decodedBuffers.push({
      buffer,
      estDuration: buffer ? buffer.duration : fallbackDur,
    });
  }

  const padStart = beat.number === 1 ? 1.35 : 0.38;
  const padEnd = beat.number === 4 ? 0.75 : 0.32;
  const availableWindow = Math.max(2, beat.durationSec - padStart - padEnd);
  const gapBetweenLines = beat.lines.length > 1 ? 0.32 : 0;
  const totalGaps = gapBetweenLines * Math.max(0, beat.lines.length - 1);
  const totalRawAudio = decodedBuffers.reduce((acc, d) => acc + d.estDuration, 0);

  const scaleFactor =
    totalRawAudio + totalGaps > availableWindow
      ? (availableWindow - totalGaps) / Math.max(0.5, totalRawAudio)
      : 1;

  let cursor = beat.startSec + padStart;
  const timedLines: TimedLine[] = [];

  beat.lines.forEach((line, idx) => {
    const raw = decodedBuffers[idx];
    const dur = Math.max(0.8, raw.estDuration * scaleFactor);
    const startSec = Number(cursor.toFixed(3));
    const endSec = Number(Math.min(beat.endSec - 0.15, cursor + dur).toFixed(3));

    timedLines.push({
      lineId: line.id,
      beatNumber: beat.number,
      speaker: line.speaker,
      text: line.text,
      koreanTranslation: koreanChunks[idx] || beat.koreanMeaning,
      startSec,
      endSec,
      audioBuffer: raw.buffer,
      sourceMode: raw.buffer ? "gemini-tts" : "silent-timed",
    });

    cursor = endSec + gapBetweenLines;
  });

  return { timedLines, ttsError };
}

/**
 * Generates English voices for all 4 beats + 2 original crossfaded instrumental tracks (30s total).
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

  const allTimedLines: TimedLine[] = [];
  let ttsFailed = false;
  let ttsErrorNotice: string | undefined;

  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    onProgress?.(
      `Synthesizing voices for Beat ${beat.number}: ${beat.title}...`,
      (i / beats.length) * 0.78
    );

    const result = await buildBeatTimedLines(beat, audioCtx, !ttsFailed);
    if (result.ttsError) {
      ttsFailed = true;
      ttsErrorNotice = result.ttsError;
    }
    allTimedLines.push(...result.timedLines);
  }

  onProgress?.("Composing Track 1 & Track 2 with 15s crossfade & foley...", 0.86);
  const musicPack = existingMusic
    ? {
        combinedBuffer: existingMusic.combinedBuffer,
        track1Buffer: existingMusic.track1Buffer,
        track2Buffer: existingMusic.track2Buffer,
      }
    : await generateOriginalSoundtrack(musicSeed, 48000);

  await audioCtx.close().catch(() => undefined);
  onProgress?.("Ready!", 1);

  return {
    generatedAt: Date.now(),
    style,
    mode: ttsFailed ? "3d-slideshow" : "3d-animation",
    timedLines: allTimedLines,
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
 * Re-synthesizes only a single beat's audio lines and merges them seamlessly
 * into the existing 30-second video package without modifying other beats.
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
    const result = await buildBeatTimedLines(updatedBeat, audioCtx, true);
    const mergedLines = [
      ...pkg.timedLines.filter((l) => l.beatNumber !== updatedBeat.number),
      ...result.timedLines,
    ].sort((a, b) => a.startSec - b.startSec);

    const hasAnySilent = mergedLines.some((l) => l.sourceMode === "silent-timed");

    return {
      ...pkg,
      generatedAt: Date.now(),
      timedLines: mergedLines,
      ttsErrorNotice: result.ttsError ?? (hasAnySilent ? pkg.ttsErrorNotice : undefined),
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

      const slotDur = Math.max(0.5, line.endSec - line.startSec);
      if (line.audioBuffer.duration > slotDur) {
        src.playbackRate.value = Math.min(1.25, line.audioBuffer.duration / slotDur);
      }

      const gain = offline.createGain();
      gain.gain.value = voiceVolume;
      src.connect(gain);
      gain.connect(offline.destination);
      src.start(line.startSec);
    }
  }

  return await offline.startRendering();
}

export function getActiveSubtitleAt(
  timeSec: number,
  timedLines: TimedLine[]
): { lines: string[]; korean: string; speaker: SpeakerRole } | null {
  for (const line of timedLines) {
    if (timeSec >= line.startSec && timeSec <= line.endSec) {
      const segs = splitSubtitleSegments(line.text, line.startSec, line.endSec);
      for (const seg of segs) {
        if (timeSec >= seg.startSec && timeSec <= seg.endSec) {
          return {
            lines: seg.lines,
            korean: line.koreanTranslation,
            speaker: line.speaker,
          };
        }
      }
      const fallback = segs[segs.length - 1];
      if (fallback) {
        return {
          lines: fallback.lines,
          korean: line.koreanTranslation,
          speaker: line.speaker,
        };
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
  timedLines: TimedLine[]
) {
  const scale = width / 1280;

  // End Credit inside 26.8s–30.0s (never extending past 30.0s)
  if (timeSec >= 26.8) {
    const alpha = Math.max(0, Math.min(1, (timeSec - 26.8) / 1.1));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `500 ${Math.round(21 * scale)}px 'Outfit', 'Noto Sans KR', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = PALETTE.darkGraphite;
    ctx.fillText(FILM_CREDIT_TEXT, width / 2, Math.round(70 * scale));
    ctx.restore();
  }

  // Burned-in English Subtitles (separate layer composited over 3D frame)
  const activeSub = getActiveSubtitleAt(timeSec, timedLines);
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
        drawSubtitles: false,
      });
      compCtx.restore();
    }

    drawBurnedSubtitlesAndCredit(
      compCtx,
      exportWidth,
      exportHeight,
      timeSec,
      pkg.timedLines
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
