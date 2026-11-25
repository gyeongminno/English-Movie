import type { Beat, DialogueLine, ExpressionItem, SceneSettings } from "../types";

export const PALETTE = {
  warmIvory: "#F2EEE6",
  apricotOrange: "#D99A70",
  sageGreen: "#A4B5A0",
  warmGray: "#C5C0B8",
  softCharcoal: "#484744",
} as const;

export const DEFAULT_EXPRESSIONS: ExpressionItem[] = [
  {
    id: "exp-1",
    expression: "The thing is",
    koreanMeaning: "실은 말이야",
    movie: "Notting Hill",
  },
  {
    id: "exp-2",
    expression: "I wish I were",
    koreanMeaning: "내가 ~라면 좋을 텐데",
    movie: "Minari",
  },
  {
    id: "exp-3",
    expression: "What if",
    koreanMeaning: "~하면 어떡하지?",
    movie: "Inside Out 2",
  },
  {
    id: "exp-4",
    expression: "freaking out",
    koreanMeaning: "당황하다, 패닉에 빠지다",
    movie: "Inside Out 2",
  },
  {
    id: "exp-5",
    expression: "Let me help",
    koreanMeaning: "내가 도와줄게",
    movie: "Notting Hill",
  },
  {
    id: "exp-6",
    expression: "Nice one",
    koreanMeaning: "잘했어",
    movie: "Notting Hill",
  },
  {
    id: "exp-7",
    expression: "I've changed my mind",
    koreanMeaning: "생각이 바뀌었어",
    movie: "Notting Hill",
  },
];

export const DEFAULT_SCENE_SETTINGS: SceneSettings = {
  title: "Shape of Me",
  place:
    "A minimalist, imaginary three-dimensional world with geometric objects, a sculptural pathway, and a small gap in the road.",
  squareCharacter:
    "A small pastel-orange 3D cube with subtly rounded edges, a matte ceramic-like surface, and minimal facial features. The square feels lonely and wants to fit in with the circles.",
  circlesCharacter:
    "Three sage-green 3D spheres with smooth matte surfaces and minimal facial features. They move by rolling naturally.",
  situation:
    "The square wants to become round because everyone around it is a circle. It tries to roll like the circles but keeps failing. When the circles cannot cross a gap in the road, the square uses its unique shape to help them. Finally, the square realizes that being different is not a bad thing.",
  theme: "Self-acceptance, friendship, individuality, and the value of being different.",
  style: "Artistic 3D animation",
};

export const DEFAULT_BEATS: Beat[] = [
  {
    id: "beat-1",
    number: 1,
    title: "Hook",
    startSec: 0,
    endSec: 7,
    durationSec: 7,
    sceneDescription:
      "Three sage-green spheres roll gracefully across a minimalist ivory landscape. A small orange cube stands alone, slightly separated from the group. The contrast between the moving spheres and the stationary cube visually expresses loneliness and difference.",
    cameraDirection:
      "Begin with a wide, carefully composed shot. Slowly move the camera toward the orange cube while maintaining generous negative space around it.",
    lightingDirection:
      "Soft, diffused natural light with gentle shadows and a slightly muted atmosphere.",
    musicDirection:
      "Use a quiet, delicate piano melody with sparse notes and a subtle ambient texture. The music should express loneliness, curiosity, and a gentle sense of longing. Keep the music soft and restrained.",
    lines: [
      {
        id: "b1-l1",
        speaker: "Square",
        text: "The thing is, I'm different. I wish I were round. Everyone looks so happy except me.",
      },
    ],
    koreanMeaning:
      "실은 말이야, 나는 달라. 나도 둥글었으면 좋겠어. 모두들 나 빼고 다 행복해 보여.",
    learningExpressions: ["The thing is", "I wish I were"],
  },
  {
    id: "beat-2",
    number: 2,
    title: "Problem",
    startSec: 7,
    endSec: 15,
    durationSec: 8,
    sceneDescription:
      "The orange cube tries to roll like the green spheres. It tilts, loses its balance, and falls onto its side. It tries again but cannot move as smoothly as the spheres. The movement should feel physically believable but slightly playful.",
    cameraDirection:
      "Use a medium shot that clearly shows the cube's unsuccessful movements. Introduce a subtle close-up to emphasize its frustration. Avoid excessive camera movement.",
    lightingDirection:
      "Make the lighting slightly cooler and the shadows subtly stronger to reflect the character's growing anxiety.",
    musicDirection:
      "Gradually introduce soft pizzicato strings, muted percussion, and a slightly irregular rhythm. The music should communicate nervousness, frustration, and mild tension without becoming dramatic or frightening. Add subtle sound effects when the cube tilts and falls.",
    lines: [
      {
        id: "b2-l1",
        speaker: "Square",
        text: "Why can't I roll like them? What if they don't like me? I'm freaking out!",
      },
    ],
    koreanMeaning:
      "나는 왜 그들처럼 구를 수 없지? 친구들이 나를 좋아하지 않으면 어떡하지? 나 너무 당황스러워!",
    learningExpressions: ["What if", "freaking out"],
  },
  {
    id: "beat-3",
    number: 3,
    title: "Turn",
    startSec: 15,
    endSec: 23,
    durationSec: 8,
    sceneDescription:
      "The green spheres reach a small gap in the sculptural pathway and stop. The orange cube notices that its unique geometric shape fits perfectly into the gap. It moves forward and places itself inside the gap, creating a stable bridge. The green spheres safely roll across the cube. The cube's difference becomes its greatest strength.",
    cameraDirection:
      "Begin with a wide shot showing the gap and the spheres. Use a slightly elevated camera angle to clearly reveal how the cube fills the gap. Emphasize the moment when the cube becomes a bridge through a carefully composed cinematic shot.",
    lightingDirection:
      "Gradually introduce warmer light as the cube discovers its ability to help the others.",
    musicDirection:
      "Gradually resolve the previous musical tension into a hopeful melody. Introduce warm piano chords, gentle marimba notes, and soft strings. Use a subtle musical accent when the cube successfully fills the gap. The music should express discovery, courage, and a sense of achievement.",
    lines: [
      {
        id: "b3-l1",
        speaker: "Circle",
        text: "Oh no! We can't get across!",
      },
      {
        id: "b3-l2",
        speaker: "Square",
        text: "Let me help you! You can roll over me.",
      },
      {
        id: "b3-l3",
        speaker: "Circle",
        text: "Nice one!",
      },
    ],
    koreanMeaning:
      "동그라미: 큰일이야! 우리 건너갈 수 없어!\n네모: 내가 도와줄게! 내 위로 굴러가면 돼.\n동그라미: 잘했어!",
    learningExpressions: ["Let me help", "Nice one"],
  },
  {
    id: "beat-4",
    number: 4,
    title: "Close",
    startSec: 23,
    endSec: 30,
    durationSec: 7,
    sceneDescription:
      "After the spheres cross the gap, the orange cube comes out and joins them. The spheres slow down so that they can move together with the cube. The cube no longer tries to change its shape. It moves forward in its own way, surrounded by its new friends. End with a balanced, visually beautiful composition showing the orange cube and green spheres together.",
    cameraDirection:
      "Slowly pull the camera back to reveal the characters moving together through the minimalist landscape. End with a calm, cinematic wide shot.",
    lightingDirection:
      "Use warm, golden, diffused light with soft shadows to create a comforting and hopeful atmosphere.",
    musicDirection:
      "Return to the original piano melody, but transform it into a warmer and more hopeful arrangement. Add gentle strings and soft ambient harmonies. End with a peaceful, emotionally satisfying musical resolution. Avoid an abrupt ending.",
    lines: [
      {
        id: "b4-l1",
        speaker: "Square",
        text: "I've changed my mind. I like being a square! Being different isn't a bad thing.",
      },
    ],
    koreanMeaning:
      "생각이 바뀌었어. 난 네모인 내가 좋아! 다르다는 건 나쁜 게 아니야.",
    learningExpressions: ["I've changed my mind"],
  },
];

export const ANIMATION_STYLES = [
  "Artistic 3D animation",
  "Minimalist 3D motion graphics",
  "2D animation",
  "Clay",
  "Watercolor",
  "Live-action style",
] as const;

export const FILM_CREDIT_TEXT = "Made with Google AI Studio · Script by 노경민";

export function countWordsInText(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

export function countBeatWords(beat: Beat): number {
  return beat.lines.reduce((acc, line) => acc + countWordsInText(line.text), 0);
}

export function countTotalScriptWords(beats: Beat[]): number {
  return beats.reduce((acc, beat) => acc + countBeatWords(beat), 0);
}

export function formatDialogueForDisplay(lines: DialogueLine[]): string {
  return lines.map((l) => `${l.speaker}: "${l.text}"`).join("\n");
}

/**
 * Splits a spoken line into timed 1–2 line subtitle chunks so subtitles
 * never exceed two lines at a time and stay word-for-word synchronized.
 */
export function splitSubtitleSegments(
  text: string,
  startSec: number,
  endSec: number
): Array<{ lines: string[]; startSec: number; endSec: number }> {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks: string[][] = [];
  let current: string[] = [];
  let charCount = 0;

  for (const w of words) {
    const nextLen = charCount + (current.length > 0 ? 1 : 0) + w.length;
    if (nextLen > 64 && current.length >= 4) {
      chunks.push(current);
      current = [w];
      charCount = w.length;
    } else {
      current.push(w);
      charCount = nextLen;
      if (/[.!?]$/.test(w) && charCount >= 24) {
        chunks.push(current);
        current = [];
        charCount = 0;
      }
    }
  }
  if (current.length > 0) {
    chunks.push(current);
  }

  const totalWords = words.length;
  const totalDur = Math.max(0.4, endSec - startSec);
  let cursor = startSec;

  return chunks.map((chunkWords, idx) => {
    const proportion = chunkWords.length / totalWords;
    const segDur =
      idx === chunks.length - 1 ? endSec - cursor : totalDur * proportion;
    const segStart = cursor;
    const segEnd = cursor + segDur;
    cursor = segEnd;

    const full = chunkWords.join(" ");
    if (full.length <= 36) {
      return { lines: [full], startSec: segStart, endSec: segEnd };
    }

    const mid = Math.ceil(full.length / 2);
    let bestBreak = full.lastIndexOf(" ", mid);
    if (bestBreak < 10) {
      bestBreak = full.indexOf(" ", mid);
    }
    if (bestBreak === -1) {
      return { lines: [full], startSec: segStart, endSec: segEnd };
    }
    return {
      lines: [full.slice(0, bestBreak).trim(), full.slice(bestBreak + 1).trim()],
      startSec: segStart,
      endSec: segEnd,
    };
  });
}
