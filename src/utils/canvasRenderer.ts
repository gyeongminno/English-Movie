import {
  DEFAULT_TIMELINE_MARKERS,
  FILM_CREDIT_TEXT,
  PALETTE,
  splitSubtitleSegments,
} from "../data/defaults";
import type {
  AnimationStyle,
  MasterTimelineMarkers,
  SpeakerRole,
  TimedLine,
  TimedSubtitleSegment,
} from "../types";
import {
  buildBotanicalFlowerStrokes,
  buildFlowerDotNodes,
  sampleBeat2PencilTap,
  sampleDotPositionAlongStrokes,
} from "./threeRenderer";

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

export interface RenderOptions {
  timeSec: number;
  style: AnimationStyle;
  mode: "animation" | "slideshow";
  timedLines: TimedLine[];
  timedSegments?: TimedSubtitleSegment[];
  timelineMarkers?: MasterTimelineMarkers;
  drawSubtitles: boolean;
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t);
}

function easeInOut(t: number): number {
  const x = clamp(t);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

function easeOutBack(t: number): number {
  const x = clamp(t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export function getActiveSubtitleAt(
  timeSec: number,
  timedLines: TimedLine[],
  timedSegments?: TimedSubtitleSegment[]
): { lines: string[]; speaker: SpeakerRole } | null {
  if (timedSegments && timedSegments.length > 0) {
    for (const seg of timedSegments) {
      if (timeSec >= seg.startSec && timeSec <= seg.endSec) {
        return { lines: seg.displayLines, speaker: seg.speaker };
      }
    }
    return null;
  }
  for (const line of timedLines) {
    if (timeSec >= line.startSec && timeSec <= line.endSec) {
      const segs = splitSubtitleSegments(line.text, line.startSec, line.endSec);
      for (const seg of segs) {
        if (timeSec >= seg.startSec && timeSec <= seg.endSec) {
          return { lines: seg.lines, speaker: line.speaker };
        }
      }
    }
  }
  return null;
}

function worldTo2D(wx: number, wz: number): [number, number] {
  return [CANVAS_WIDTH / 2 + wx * 135, CANVAS_HEIGHT * 0.54 + wz * 115];
}

function drawPaperBackground(
  ctx: CanvasRenderingContext2D,
  style: AnimationStyle,
  timeSec: number
) {
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  grad.addColorStop(0, "#FDFBF6");
  grad.addColorStop(1, PALETTE.warmIvory);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.strokeStyle = "rgba(180, 174, 162, 0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 28, CANVAS_WIDTH - 72, CANVAS_HEIGHT - 56);

  if (style === "Watercolor") {
    ctx.save();
    ctx.globalAlpha = 0.14;
    const w = ctx.createRadialGradient(640, 320, 40, 640, 320, 460);
    w.addColorStop(0, "#FFF4CC");
    w.addColorStop(1, "rgba(255,244,204,0)");
    ctx.fillStyle = w;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();
  }

  if (timeSec >= 16.5) {
    const p = clamp((timeSec - 16.5) / 3.5);
    ctx.save();
    ctx.globalAlpha = p * 0.2;
    const glow = ctx.createRadialGradient(640, 260, 20, 640, 260, 520);
    glow.addColorStop(0, "#FFE9BE");
    glow.addColorStop(1, "rgba(255,233,190,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();
  }
}

function drawGraphiteFlower2D(
  ctx: CanvasRenderingContext2D,
  timeSec: number,
  markers: MasterTimelineMarkers,
  dotNodes: ReturnType<typeof buildFlowerDotNodes>,
  flowerStrokes: ReturnType<typeof buildBotanicalFlowerStrokes>
) {
  for (const node of dotNodes) {
    if (timeSec < node.timeSec) continue;
    const [px, py] = worldTo2D(node.pos[0], node.pos[1]);
    const r = lerp(3, node.radius * 0.72, easeOutBack((timeSec - node.timeSec) / 0.15));
    ctx.fillStyle = PALETTE.darkGraphite;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const strayStart = markers.beat2StartSec + 0.8;
  const wipeStart = markers.beat4StartSec + 0.35;
  const wipeEnd = Math.max(wipeStart + 0.45, markers.apologyStartSec - 0.08);
  if (timeSec >= strayStart && timeSec < wipeEnd) {
    const fade =
      timeSec > wipeStart
        ? 1 - clamp((timeSec - wipeStart) / Math.max(0.25, wipeEnd - wipeStart))
        : 1;
    const [sx, sy] = worldTo2D(1.85, 1.25);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = PALETTE.darkGraphite;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 8, 5, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = PALETTE.darkGraphite;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const stroke of flowerStrokes) {
    if (timeSec < stroke.startSec) continue;
    const prog = clamp(
      (timeSec - stroke.startSec) / Math.max(0.01, stroke.endSec - stroke.startSec)
    );
    const maxIndex = prog * (stroke.points.length - 1);
    const whole = Math.floor(maxIndex);
    const frac = maxIndex - whole;

    ctx.lineWidth = stroke.width * 0.9;
    ctx.beginPath();
    const [x0, y0] = worldTo2D(stroke.points[0][0], stroke.points[0][1]);
    ctx.moveTo(x0, y0);

    for (let i = 1; i <= whole; i++) {
      const [px, py] = worldTo2D(stroke.points[i][0], stroke.points[i][1]);
      ctx.lineTo(px, py);
    }
    if (frac > 0 && whole < stroke.points.length - 1) {
      const a = stroke.points[whole];
      const b = stroke.points[whole + 1];
      const [ix, iy] = worldTo2D(lerp(a[0], b[0], frac), lerp(a[1], b[1], frac));
      ctx.lineTo(ix, iy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawPencil2D(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  tiltRad: number,
  mood: "curious" | "nervous" | "relaxed",
  timeSec: number
) {
  ctx.save();
  ctx.translate(tipX, tipY);
  ctx.rotate(tiltRad);

  // Soft shadow at tip
  ctx.fillStyle = "rgba(36, 36, 36, 0.14)";
  ctx.beginPath();
  ctx.ellipse(6, 4, 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sharpened wood cone
  ctx.fillStyle = "#E4C093";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-16, -34);
  ctx.lineTo(16, -34);
  ctx.closePath();
  ctx.fill();

  // Graphite tip
  ctx.fillStyle = PALETTE.darkGraphite;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-6, -13);
  ctx.lineTo(6, -13);
  ctx.closePath();
  ctx.fill();

  // Vivid yellow barrel (#F5C518)
  ctx.fillStyle = PALETTE.pencilYellow;
  ctx.fillRect(-16, -150, 32, 116);
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.fillRect(-10, -150, 7, 116);

  // Ferrule & top cap
  ctx.fillStyle = "#D8D2C5";
  ctx.fillRect(-16, -164, 32, 14);
  ctx.fillStyle = "#ECE6D8";
  ctx.beginPath();
  ctx.roundRect(-15, -176, 30, 12, [6, 6, 0, 0]);
  ctx.fill();

  // ONLY two small expressive eyes (no mouth, no eyebrows)
  const blink = (timeSec % 3.4) > 3.28;
  const eyeH = blink ? 1.2 : mood === "nervous" ? 5.2 : 4.6;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.ellipse(-6.5, -88, 4.2, eyeH, 0, 0, Math.PI * 2);
  ctx.ellipse(6.5, -88, 4.2, eyeH, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!blink) {
    const px = mood === "nervous" ? Math.sin(timeSec * 10) * 1.4 : 0.8;
    ctx.fillStyle = PALETTE.darkGraphite;
    ctx.beginPath();
    ctx.arc(-6.5 + px, -88, 2.2, 0, Math.PI * 2);
    ctx.arc(6.5 + px, -88, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawEraser2D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tilt: number,
  mood: "strict" | "amazed" | "relaxed",
  timeSec: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);

  ctx.fillStyle = "rgba(36, 36, 36, 0.15)";
  ctx.beginPath();
  ctx.ellipse(0, 48, 38, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cobalt-blue rubber block (#2449D8)
  ctx.fillStyle = PALETTE.eraserBlue;
  ctx.beginPath();
  ctx.roundRect(-36, -46, 72, 92, 13);
  ctx.fill();

  // ONLY two small expressive eyes (no mouth, no eyebrows)
  const blink = ((timeSec + 1.2) % 3.9) > 3.76;
  const eyeH = blink ? 1.4 : mood === "strict" ? 3.5 : mood === "amazed" ? 7.2 : 5.4;

  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.ellipse(-12, -16, 5.4, eyeH, 0, 0, Math.PI * 2);
  ctx.ellipse(12, -16, 5.4, eyeH, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!blink) {
    ctx.fillStyle = PALETTE.darkGraphite;
    ctx.beginPath();
    ctx.arc(-13, -16, 2.8, 0, Math.PI * 2);
    ctx.arc(11, -16, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  options: RenderOptions
): void {
  const { timeSec, style, mode, timedLines, timedSegments, drawSubtitles } = options;
  const markers = options.timelineMarkers ?? DEFAULT_TIMELINE_MARKERS;
  const dotNodes = buildFlowerDotNodes(markers);
  const flowerStrokes = buildBotanicalFlowerStrokes(markers);
  const t = clamp(timeSec, 0, 30);

  ctx.save();
  if (mode === "slideshow") {
    const zoom = 1 + Math.sin(t * 0.4) * 0.03;
    ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-CANVAS_WIDTH / 2, -CANVAS_HEIGHT / 2);
  }

  drawPaperBackground(ctx, style, t);
  drawGraphiteFlower2D(ctx, t, markers, dotNodes, flowerStrokes);

  if (t < markers.beat2StartSec) {
    const enterEnd = Math.max(0.45, markers.dot1TapSec - 0.22);
    const tapEnd = markers.dot1TapSec + 0.25;
    const [dxBase, dyBase] = worldTo2D(0.05, 1.85);
    let px = dxBase;
    let py = dyBase;
    if (t < enterEnd) {
      px = lerp(340, dxBase, easeInOut(t / enterEnd));
      py = lerp(dyBase - 50, dyBase - 12, easeInOut(t / enterEnd));
    } else if (t < tapEnd) {
      px = dxBase;
      py = dyBase;
    } else {
      px = lerp(dxBase, dxBase - 120, easeInOut((t - tapEnd) / 1.1));
      py = dyBase - 10;
    }
    drawPencil2D(ctx, px, py, -0.22, "curious", t);

    const ex = lerp(
      1180,
      815,
      easeInOut(
        (t - markers.eraserArriveStartSec) /
          Math.max(0.35, markers.eraserNoticeDotSec - markers.eraserArriveStartSec)
      )
    );
    const [, ey] = worldTo2D(1.28, 1.75);
    drawEraser2D(ctx, ex, ey - 32, 0.05, "strict", t);
  } else if (t < markers.beat3StartSec) {
    const tap = sampleBeat2PencilTap(dotNodes, t, markers.beat2StartSec);
    const [px, py] = worldTo2D(tap.x, tap.z);
    const lag = sampleBeat2PencilTap(
      dotNodes,
      Math.max(markers.beat2StartSec + 0.05, t - 0.85),
      markers.beat2StartSec
    );
    const [ex, ey] = worldTo2D(lag.x + 0.92, lag.z + 0.62);
    drawPencil2D(ctx, px, py - tap.y * 90, -0.2, "nervous", t);
    drawEraser2D(ctx, ex, ey - 32, -0.1, "strict", t);
  } else if (t < markers.beat4StartSec) {
    const b3 = markers.beat3StartSec;
    const revealEnd = markers.flowerRevealPeakSec + 0.22;
    const pt = sampleDotPositionAlongStrokes(flowerStrokes, t);
    const exitP = easeInOut((t - revealEnd) / 1.1);
    const [px, py] = pt
      ? worldTo2D(pt[0], pt[1])
      : worldTo2D(lerp(0, -1.68, exitP), lerp(-0.94, 0.96, exitP));
    const watchP = easeInOut((t - b3) / Math.max(0.8, markers.eraserAmazedSec - b3));
    const [ex, ey] = worldTo2D(lerp(1.35, 2.02, watchP), 0.35);
    drawPencil2D(ctx, px, py, -0.22, t > revealEnd ? "relaxed" : "curious", t);
    drawEraser2D(
      ctx,
      ex,
      ey - 32,
      0.04,
      t >= markers.eraserAmazedSec - 0.1 ? "amazed" : "strict",
      t
    );
  } else {
    const b4 = markers.beat4StartSec;
    const wipeStart = b4 + 0.35;
    const wipeEnd = Math.max(wipeStart + 0.45, markers.apologyStartSec - 0.08);
    const strokePos = sampleDotPositionAlongStrokes(flowerStrokes, t);
    const detailStroke = flowerStrokes[flowerStrokes.length - 1];
    const detailStart = detailStroke?.startSec ?? markers.apologyEndSec + 0.08;
    const detailEnd = detailStroke?.endSec ?? detailStart + 1.25;
    const pWorld: [number, number] = strokePos
      ? strokePos
      : t < detailStart
      ? [
          lerp(-1.68, 0.08, easeInOut((t - b4) / Math.max(0.4, detailStart - b4))),
          lerp(0.96, 1.38, easeInOut((t - b4) / Math.max(0.4, detailStart - b4))),
        ]
      : [
          lerp(0.58, -1.58, easeInOut((t - detailEnd) / 1.15)),
          lerp(0.86, 1.05, easeInOut((t - detailEnd) / 1.15)),
        ];
    const [px, py] = worldTo2D(pWorld[0], pWorld[1]);

    const exWorld =
      t < wipeEnd
        ? 1.85 + Math.sin((t - wipeStart) * 14) * 0.16
        : lerp(1.85, 1.65, easeInOut((t - wipeEnd) / 0.9));
    const [ex, ey] = worldTo2D(exWorld, 1.15);
    drawPencil2D(ctx, px, py, -0.22, "relaxed", t);
    drawEraser2D(
      ctx,
      ex,
      ey - 32,
      t >= markers.apologyStartSec && t <= markers.apologyEndSec ? -0.11 : 0,
      "relaxed",
      t
    );
  }

  ctx.restore();

  if (t >= markers.creditStartSec) {
    ctx.save();
    ctx.globalAlpha = clamp((t - markers.creditStartSec) / 1.1);
    ctx.font = "600 22px 'Outfit', 'Noto Sans KR', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = PALETTE.darkGraphite;
    ctx.fillText(FILM_CREDIT_TEXT, CANVAS_WIDTH / 2, 74);
    ctx.restore();
  }

  if (drawSubtitles) {
    const activeSub = getActiveSubtitleAt(t, timedLines, timedSegments);
    if (activeSub && activeSub.lines.length > 0) {
      ctx.save();
      ctx.font = "700 32px 'Plus Jakarta Sans', 'Noto Sans KR', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const baseY = activeSub.lines.length === 2 ? CANVAS_HEIGHT - 84 : CANVAS_HEIGHT - 56;
      activeSub.lines.slice(0, 2).forEach((line, i) => {
        const y = baseY + i * 42;
        ctx.strokeStyle = "rgba(36,36,36,0.92)";
        ctx.lineWidth = 7;
        ctx.strokeText(line, CANVAS_WIDTH / 2, y);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(line, CANVAS_WIDTH / 2, y);
      });
      ctx.restore();
    }
  }
}
