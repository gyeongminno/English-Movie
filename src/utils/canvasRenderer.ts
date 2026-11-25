import { FILM_CREDIT_TEXT, splitSubtitleSegments } from "../data/defaults";
import type { AnimationStyle, TimedLine } from "../types";

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;
const GROUND_Y = 500;
const SQUARE_SIZE = 84;
const CIRCLE_RADIUS = 38;
const GAP_CENTER_X = 660;
const GAP_WIDTH = 92;

export interface RenderOptions {
  timeSec: number;
  style: AnimationStyle;
  mode: "animation" | "slideshow";
  timedLines: TimedLine[];
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
  timedLines: TimedLine[]
): { lines: string[]; speaker: "Square" | "Circle" } | null {
  for (const line of timedLines) {
    if (timeSec >= line.startSec && timeSec <= line.endSec) {
      const segs = splitSubtitleSegments(line.text, line.startSec, line.endSec);
      for (const seg of segs) {
        if (timeSec >= seg.startSec && timeSec <= seg.endSec) {
          return { lines: seg.lines, speaker: line.speaker };
        }
      }
      const fallback = segs[segs.length - 1];
      if (fallback) {
        return { lines: fallback.lines, speaker: line.speaker };
      }
    }
  }
  return null;
}

function getActiveSpeakerAt(
  timeSec: number,
  timedLines: TimedLine[]
): "Square" | "Circle" | null {
  for (const line of timedLines) {
    if (timeSec >= line.startSec && timeSec <= line.endSec) {
      return line.speaker;
    }
  }
  return null;
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  style: AnimationStyle,
  timeSec: number,
  showGap: boolean
) {
  // Warm ivory sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  if (style === "Live-action style") {
    grad.addColorStop(0, "#FAF5EA");
    grad.addColorStop(1, "#EFE6D5");
  } else {
    grad.addColorStop(0, "#FCF9F2");
    grad.addColorStop(1, "#F6EFE1");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Subtle watercolor wash texture if Watercolor style
  if (style === "Watercolor") {
    ctx.save();
    ctx.globalAlpha = 0.22;
    const wash1 = ctx.createRadialGradient(280, 180, 30, 280, 180, 340);
    wash1.addColorStop(0, "#F9E2CA");
    wash1.addColorStop(1, "rgba(249,226,202,0)");
    ctx.fillStyle = wash1;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const wash2 = ctx.createRadialGradient(980, 210, 30, 980, 210, 360);
    wash2.addColorStop(0, "#DCE8DE");
    wash2.addColorStop(1, "rgba(220,232,222,0)");
    ctx.fillStyle = wash2;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();
  }

  // Soft minimalist geometric background shapes (calm & unobtrusive)
  ctx.save();
  ctx.fillStyle = style === "Live-action style" ? "rgba(218, 207, 187, 0.35)" : "rgba(226, 217, 198, 0.42)";
  const drift = Math.sin(timeSec * 0.25) * 6;
  ctx.beginPath();
  ctx.arc(210 + drift, 190, 58, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(1050 - drift * 0.8, 155, 74, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.roundRect(620 + drift * 0.5, 115, 52, 52, 10);
  ctx.fill();
  ctx.restore();

  // Flat pathway
  ctx.save();
  const groundColor = style === "Clay" ? "#EADEC9" : "#ECE3D0";
  const lineColor = "#D4C7B0";

  if (!showGap) {
    ctx.fillStyle = groundColor;
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.stroke();
  } else {
    const gapLeft = GAP_CENTER_X - GAP_WIDTH / 2;
    const gapRight = GAP_CENTER_X + GAP_WIDTH / 2;
    const gapDepth = SQUARE_SIZE + 6;

    // Left ground
    ctx.fillStyle = groundColor;
    ctx.fillRect(0, GROUND_Y, gapLeft, CANVAS_HEIGHT - GROUND_Y);
    // Right ground
    ctx.fillRect(gapRight, GROUND_Y, CANVAS_WIDTH - gapRight, CANVAS_HEIGHT - GROUND_Y);
    // Floor beneath gap
    ctx.fillRect(gapLeft, GROUND_Y + gapDepth, GAP_WIDTH, CANVAS_HEIGHT - (GROUND_Y + gapDepth));

    // Gap recess shading
    ctx.fillStyle = "rgba(170, 156, 134, 0.18)";
    ctx.fillRect(gapLeft, GROUND_Y, GAP_WIDTH, gapDepth);

    // Pathway outline
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(gapLeft, GROUND_Y);
    ctx.lineTo(gapLeft, GROUND_Y + gapDepth);
    ctx.lineTo(gapRight, GROUND_Y + gapDepth);
    ctx.lineTo(gapRight, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.stroke();
  }
  ctx.restore();

  if (style === "Live-action style") {
    ctx.save();
    const vig = ctx.createRadialGradient(
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2,
      340,
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2,
      780
    );
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(70,58,42,0.12)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();
  }
}

type Mood = "sad" | "worried" | "neutral" | "happy" | "helping";

function drawFace(
  ctx: CanvasRenderingContext2D,
  mood: Mood,
  isTalking: boolean,
  timeSec: number,
  lookX = 0,
  lookY = 0,
  scale = 1
) {
  ctx.save();
  ctx.scale(scale, scale);
  const ink = "#2B2D2F";

  // Subtle blink every ~3.4s
  const blinkPhase = (timeSec * 1.1) % 3.4;
  const isBlinking = blinkPhase > 3.28;

  const eyeY = -7;
  const eyeOffset = 14;

  // Eyes
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";

  for (const side of [-1, 1]) {
    const ex = side * eyeOffset + lookX * 3;
    const ey = eyeY + lookY * 2;
    if (isBlinking) {
      ctx.beginPath();
      ctx.moveTo(ex - 4.5, ey);
      ctx.lineTo(ex + 4.5, ey);
      ctx.stroke();
    } else if (mood === "happy") {
      ctx.beginPath();
      ctx.arc(ex, ey + 1.5, 4.5, Math.PI, 0, false);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(ex, ey, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Eyebrows for worried/sad
  if (mood === "worried" || mood === "sad") {
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-eyeOffset - 5, eyeY - 9);
    ctx.lineTo(-eyeOffset + 4, mood === "worried" ? eyeY - 12 : eyeY - 11);
    ctx.moveTo(eyeOffset + 5, eyeY - 9);
    ctx.lineTo(eyeOffset - 4, mood === "worried" ? eyeY - 12 : eyeY - 11);
    ctx.stroke();
  }

  // Mouth
  const mouthY = 12;
  ctx.lineWidth = 2.6;
  if (isTalking) {
    const talkOpen = 2.5 + Math.abs(Math.sin(timeSec * 15)) * 5.2;
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.ellipse(0, mouthY, 6.5, talkOpen, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (mood === "happy" || mood === "helping") {
    ctx.beginPath();
    ctx.arc(0, mouthY - 3, 9, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (mood === "sad") {
    ctx.beginPath();
    ctx.arc(0, mouthY + 7, 8, 1.18 * Math.PI, 1.82 * Math.PI);
    ctx.stroke();
  } else if (mood === "worried") {
    ctx.beginPath();
    ctx.moveTo(-7, mouthY + 2);
    ctx.quadraticCurveTo(-2, mouthY - 2, 0, mouthY + 1);
    ctx.quadraticCurveTo(3, mouthY + 4, 7, mouthY);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-6, mouthY);
    ctx.lineTo(6, mouthY);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSquareCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rotationRad: number,
  scaleX: number,
  scaleY: number,
  mood: Mood,
  isTalking: boolean,
  timeSec: number,
  style: AnimationStyle,
  lookX = 0
) {
  // Ground shadow
  const distFromGround = Math.max(0, GROUND_Y - (y + SQUARE_SIZE / 2));
  const shadowScale = clamp(1 - distFromGround / 180, 0.45, 1);
  ctx.save();
  ctx.fillStyle =
    style === "Live-action style" ? "rgba(70, 58, 42, 0.18)" : "rgba(130, 114, 92, 0.16)";
  ctx.beginPath();
  ctx.ellipse(x, GROUND_Y + 4, 42 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotationRad);
  ctx.scale(scaleX, scaleY);

  const half = SQUARE_SIZE / 2;
  const radius = 12;

  if (style === "Watercolor") {
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = "#F4A261";
    ctx.beginPath();
    ctx.roundRect(-half - 2, -half - 2, SQUARE_SIZE + 4, SQUARE_SIZE + 4, radius + 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Body fill
  if (style === "Clay" || style === "Live-action style") {
    const grad = ctx.createLinearGradient(-half, -half, half, half);
    grad.addColorStop(0, "#F9B87E");
    grad.addColorStop(0.55, "#F4A261");
    grad.addColorStop(1, "#DF8642");
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = "#F4A261";
  }

  ctx.beginPath();
  ctx.roundRect(-half, -half, SQUARE_SIZE, SQUARE_SIZE, radius);
  ctx.fill();

  // Clay highlight
  if (style === "Clay") {
    ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
    ctx.beginPath();
    ctx.roundRect(-half + 7, -half + 6, SQUARE_SIZE - 26, 14, 7);
    ctx.fill();
  }

  // Clean outline
  ctx.strokeStyle = style === "Watercolor" ? "rgba(201, 115, 52, 0.55)" : "#D88240";
  ctx.lineWidth = style === "2D animation" ? 3 : 2;
  ctx.beginPath();
  ctx.roundRect(-half, -half, SQUARE_SIZE, SQUARE_SIZE, radius);
  ctx.stroke();

  drawFace(ctx, mood, isTalking, timeSec, lookX, 0, 1);

  ctx.restore();
}

function drawCircleCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rollAngleRad: number,
  radius: number,
  mood: Mood,
  isTalking: boolean,
  timeSec: number,
  style: AnimationStyle,
  lookX = 0
) {
  // Ground shadow
  const distFromGround = Math.max(0, GROUND_Y - (y + radius));
  const shadowScale = clamp(1 - distFromGround / 180, 0.45, 1);
  ctx.save();
  ctx.fillStyle =
    style === "Live-action style" ? "rgba(70, 58, 42, 0.18)" : "rgba(110, 125, 110, 0.16)";
  ctx.beginPath();
  ctx.ellipse(x, GROUND_Y + 4, radius * 0.92 * shadowScale, 7.5 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);

  if (style === "Watercolor") {
    ctx.globalAlpha = 0.86;
    ctx.fillStyle = "#84A98C";
    ctx.beginPath();
    ctx.arc(0, 0, radius + 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (style === "Clay" || style === "Live-action style") {
    const grad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.35, 4, 0, 0, radius);
    grad.addColorStop(0, "#A9CBB0");
    grad.addColorStop(0.65, "#84A98C");
    grad.addColorStop(1, "#668A6E");
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = "#84A98C";
  }

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  if (style === "Clay") {
    ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
    ctx.beginPath();
    ctx.ellipse(-radius * 0.25, -radius * 0.35, radius * 0.36, radius * 0.18, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = style === "Watercolor" ? "rgba(95, 128, 102, 0.55)" : "#688B70";
  ctx.lineWidth = style === "2D animation" ? 3 : 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Subtle face tilt when rolling
  ctx.rotate(Math.sin(rollAngleRad) * 0.22);
  drawFace(ctx, mood, isTalking, timeSec, lookX, 0, 0.92);

  ctx.restore();
}

function drawSubtitleOverlay(
  ctx: CanvasRenderingContext2D,
  lines: string[]
) {
  if (lines.length === 0) return;

  ctx.save();
  ctx.font = "700 32px 'Plus Jakarta Sans', 'Noto Sans KR', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const lineHeight = 42;
  const baseY = lines.length === 2 ? CANVAS_HEIGHT - 84 : CANVAS_HEIGHT - 56;

  lines.slice(0, 2).forEach((text, i) => {
    const y = baseY + i * lineHeight;
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.shadowColor = "rgba(20, 22, 24, 0.45)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.strokeStyle = "rgba(24, 26, 29, 0.92)";
    ctx.lineWidth = 7;
    ctx.strokeText(text, CANVAS_WIDTH / 2, y);

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(text, CANVAS_WIDTH / 2, y);
  });

  ctx.restore();
}

function drawEndCredit(ctx: CanvasRenderingContext2D, timeSec: number) {
  if (timeSec < 26.8) return;
  const alpha = clamp((timeSec - 26.8) / 1.1, 0, 1);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = "600 22px 'Outfit', 'Noto Sans KR', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#3E4246";
  ctx.fillText(FILM_CREDIT_TEXT, CANVAS_WIDTH / 2, 74);
  ctx.restore();
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  options: RenderOptions
): void {
  const { timeSec, style, mode, timedLines, drawSubtitles } = options;
  const t = clamp(timeSec, 0, 30);
  const activeSpeaker = getActiveSpeakerAt(t, timedLines);
  const squareTalking = activeSpeaker === "Square";
  const circleTalking = activeSpeaker === "Circle";

  // Determine beat
  let beat: 1 | 2 | 3 | 4 = 1;
  if (t >= 23) beat = 4;
  else if (t >= 15) beat = 3;
  else if (t >= 7) beat = 2;

  const showGap = beat === 3 || beat === 4;

  // Slideshow zoom/pan transform if fallback slideshow mode
  ctx.save();
  if (mode === "slideshow") {
    const beatStarts = [0, 7, 15, 23];
    const beatEnds = [7, 15, 23, 30];
    const bStart = beatStarts[beat - 1];
    const bEnd = beatEnds[beat - 1];
    const bt = (t - bStart) / (bEnd - bStart);
    const zoom = 1 + bt * 0.06;
    const panX = (beat % 2 === 0 ? -1 : 1) * bt * 18;
    ctx.translate(CANVAS_WIDTH / 2 + panX, CANVAS_HEIGHT / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-CANVAS_WIDTH / 2, -CANVAS_HEIGHT / 2);
  }

  drawBackground(ctx, style, t, showGap);

  if (beat === 1) {
    // Beat 1 (0–7s): 3 green circles happily roll across; orange square stands alone & watches
    const bt = t / 7;
    const baseCircleX = lerp(340, 1420, easeInOut(bt));
    const offsets = [0, -108, -216];
    const radii = [38, 35, 40];

    offsets.forEach((off, idx) => {
      const cx = baseCircleX + off;
      const bounce = Math.abs(Math.sin(t * 4.5 + idx * 0.8)) * 7;
      const cy = GROUND_Y - radii[idx] - bounce;
      drawCircleCharacter(
        ctx,
        cx,
        cy,
        cx / radii[idx],
        radii[idx],
        "happy",
        false,
        t + idx * 0.3,
        style,
        1
      );
    });

    const sqX = 240;
    const sqY = GROUND_Y - SQUARE_SIZE / 2;
    const lookDir = baseCircleX > sqX ? 1 : -1;
    drawSquareCharacter(
      ctx,
      sqX,
      sqY,
      0,
      1,
      1,
      "sad",
      squareTalking,
      t,
      style,
      lookDir
    );
  } else if (beat === 2) {
    // Beat 2 (7–15s): Square tries to roll, tilts side to side, falls over, frustrated
    const bt = t - 7; // 0..8
    const sqXBase = 640;
    let sqX = sqXBase;
    let sqY = GROUND_Y - SQUARE_SIZE / 2;
    let rot = 0;
    let scaleX = 1;
    let scaleY = 1;

    if (bt < 2.2) {
      // Attempt 1: lean onto right corner and fall
      const p = bt / 2.2;
      if (p < 0.55) {
        const tilt = easeInOut(p / 0.55);
        rot = tilt * (Math.PI / 4);
        sqX = sqXBase + tilt * 35;
        sqY = GROUND_Y - SQUARE_SIZE / 2 - Math.sin(tilt * Math.PI) * 18;
      } else {
        const fall = easeOutBack((p - 0.55) / 0.45);
        rot = lerp(Math.PI / 4, Math.PI / 2, fall);
        sqX = sqXBase + 35 + fall * 28;
        scaleX = 1 + Math.sin(fall * Math.PI) * 0.08;
        scaleY = 1 - Math.sin(fall * Math.PI) * 0.08;
      }
    } else if (bt < 5.0) {
      // Attempt 2: hop up & try rolling left
      const p = (bt - 2.2) / 2.8;
      if (p < 0.45) {
        const tilt = easeInOut(p / 0.45);
        rot = -tilt * (Math.PI / 3.8);
        sqX = lerp(sqXBase + 63, sqXBase - 25, tilt);
        sqY = GROUND_Y - SQUARE_SIZE / 2 - Math.sin(tilt * Math.PI) * 24;
      } else {
        const fall = easeOutBack((p - 0.45) / 0.55);
        rot = lerp(-Math.PI / 3.8, -Math.PI / 2, fall);
        sqX = lerp(sqXBase - 25, sqXBase - 65, fall);
        scaleX = 1 + Math.sin(fall * Math.PI) * 0.09;
        scaleY = 1 - Math.sin(fall * Math.PI) * 0.09;
      }
    } else {
      // Settle upright, shaking/worried
      const p = clamp((bt - 5.0) / 0.8);
      rot = lerp(-Math.PI / 2, 0, easeOutBack(p));
      sqX = lerp(sqXBase - 65, sqXBase, easeInOut(p));
      if (p >= 1) {
        rot = Math.sin((bt - 5.8) * 9) * 0.05;
      }
    }

    drawSquareCharacter(
      ctx,
      sqX,
      sqY,
      rot,
      scaleX,
      scaleY,
      "worried",
      squareTalking,
      t,
      style,
      0
    );
  } else if (beat === 3) {
    // Beat 3 (15–23s): Circles stop at gap; square drops into gap as bridge; circles roll across!
    const bt = t - 15; // 0..8
    const radii = [38, 35, 40];

    // Square choreography
    let sqX = 210;
    let sqY = GROUND_Y - SQUARE_SIZE / 2;
    let sqMood: Mood = "neutral";

    if (bt < 2.2) {
      sqX = 210;
      sqMood = "neutral";
    } else if (bt < 3.6) {
      // Slide toward gap
      const p = easeInOut((bt - 2.2) / 1.4);
      sqX = lerp(210, GAP_CENTER_X, p);
      sqY = GROUND_Y - SQUARE_SIZE / 2 - Math.sin(p * Math.PI) * 45;
      sqMood = "helping";
    } else if (bt < 4.3) {
      // Drop into gap
      const p = easeOutBack((bt - 3.6) / 0.7);
      sqX = GAP_CENTER_X;
      sqY = lerp(GROUND_Y - SQUARE_SIZE / 2, GROUND_Y + SQUARE_SIZE / 2 + 2, p);
      sqMood = "helping";
    } else {
      // Seated in gap as flat bridge
      sqX = GAP_CENTER_X;
      sqY = GROUND_Y + SQUARE_SIZE / 2 + 2;
      sqMood = "helping";
    }

    // Draw square first so rolling circles cross over its top cleanly
    drawSquareCharacter(
      ctx,
      sqX,
      sqY,
      0,
      1,
      1,
      sqMood,
      squareTalking,
      t,
      style,
      1
    );

    // Circles choreography
    const stopPositions = [545, 452, 360];
    const endPositions = [1040, 935, 835];

    stopPositions.forEach((stopX, idx) => {
      const r = radii[idx];
      let cx = stopX;
      let cy = GROUND_Y - r;
      let cMood: Mood = "worried";
      let roll = 0;

      if (bt < 1.6) {
        const p = easeInOut(bt / 1.6);
        cx = lerp(stopX - 360, stopX, p);
        roll = cx / r;
        cMood = bt > 1.1 ? "worried" : "happy";
      } else if (bt < 4.5) {
        cx = stopX;
        cMood = "worried";
      } else {
        // Roll safely across the square bridge!
        const delay = idx * 0.45;
        const p = easeInOut((bt - 4.5 - delay) / 2.2);
        cx = lerp(stopX, endPositions[idx], p);
        roll = cx / r;
        const bounce = p > 0 && p < 1 ? Math.abs(Math.sin(p * Math.PI * 3)) * 5 : 0;
        cy = GROUND_Y - r - bounce;
        cMood = p > 0.35 ? "happy" : "neutral";
      }

      drawCircleCharacter(
        ctx,
        cx,
        cy,
        roll,
        r,
        cMood,
        circleTalking && idx === 0,
        t + idx * 0.25,
        style,
        1
      );
    });
  } else {
    // Beat 4 (23–30s): Square exits gap, joins circles, all move forward together
    const bt = t - 23; // 0..7
    const radii = [38, 35, 40];

    let sqX = GAP_CENTER_X;
    let sqY = GROUND_Y + SQUARE_SIZE / 2 + 2;

    if (bt < 1.4) {
      // Pop out of gap onto right side
      const p = easeOutBack(bt / 1.4);
      sqX = lerp(GAP_CENTER_X, 780, easeInOut(bt / 1.4));
      sqY = lerp(
        GROUND_Y + SQUARE_SIZE / 2 + 2,
        GROUND_Y - SQUARE_SIZE / 2,
        p
      ) - Math.sin(clamp(bt / 1.4) * Math.PI) * 65;
    } else if (bt < 4.2) {
      sqX = 780;
      const hop = Math.abs(Math.sin((bt - 1.4) * 3.2)) * 8;
      sqY = GROUND_Y - SQUARE_SIZE / 2 - hop;
    } else {
      // Move forward happily together
      const p = easeInOut((bt - 4.2) / 2.8);
      sqX = lerp(780, 1080, p);
      const hop = Math.abs(Math.sin((bt - 4.2) * 4.5)) * 10;
      sqY = GROUND_Y - SQUARE_SIZE / 2 - hop;
    }

    drawSquareCharacter(
      ctx,
      sqX,
      sqY,
      0,
      1,
      1,
      "happy",
      squareTalking,
      t,
      style,
      1
    );

    const startCircleX = [1040, 935, 835];
    // Spread cleanly beside the square
    const gatherCircleX = [1080, 985, 890];

    startCircleX.forEach((sx, idx) => {
      const r = radii[idx];
      let cx = sx;
      let cy = GROUND_Y - r;
      let roll = 0;

      if (bt < 1.5) {
        const p = easeInOut(bt / 1.5);
        cx = lerp(sx, gatherCircleX[idx], p);
        const hop = Math.abs(Math.sin(bt * 5 + idx)) * 12;
        cy = GROUND_Y - r - hop;
      } else if (bt < 4.2) {
        cx = gatherCircleX[idx];
        const hop = Math.abs(Math.sin((bt - 1.5) * 4 + idx * 0.7)) * 10;
        cy = GROUND_Y - r - hop;
      } else {
        const p = easeInOut((bt - 4.2) / 2.8);
        cx = lerp(gatherCircleX[idx], gatherCircleX[idx] + 300, p);
        roll = (cx - gatherCircleX[idx]) / r;
        const hop = Math.abs(Math.sin((bt - 4.2) * 4 + idx)) * 5;
        cy = GROUND_Y - r - hop;
      }

      drawCircleCharacter(
        ctx,
        cx,
        cy,
        roll,
        r,
        "happy",
        false,
        t + idx * 0.2,
        style,
        1
      );
    });
  }

  ctx.restore();

  // Gentle soft transition veil at beat boundaries (0.25s)
  const boundaries = [7, 15, 23];
  for (const b of boundaries) {
    const dist = Math.abs(t - b);
    if (dist < 0.22) {
      const fadeAlpha = (1 - dist / 0.22) * 0.22;
      ctx.save();
      ctx.fillStyle = `rgba(251, 248, 241, ${fadeAlpha})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
    }
  }

  // Final credit inside the 30-second clip
  drawEndCredit(ctx, t);

  // Separate subtitle layer (drawn here when exporting MP4 or requested)
  if (drawSubtitles) {
    const activeSub = getActiveSubtitleAt(t, timedLines);
    if (activeSub) {
      drawSubtitleOverlay(ctx, activeSub.lines);
    }
  }
}
