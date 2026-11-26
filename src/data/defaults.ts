import type { Beat, DialogueLine, ExpressionItem, SceneSettings } from "../types";

export const PALETTE = {
  pencilYellow: "#F5C518",
  eraserBlue: "#2449D8",
  darkGraphite: "#242424",
  warmIvory: "#FAF7EF",
} as const;

export const DEFAULT_EXPRESSIONS: ExpressionItem[] = [
  {
    id: "exp-1",
    expression: "Oops",
    koreanMeaning: "앗, 이런!",
    movie: "Notting Hill",
  },
  {
    id: "exp-2",
    expression: "belong here",
    koreanMeaning: "여기에 속하다",
    movie: "Notting Hill",
  },
  {
    id: "exp-3",
    expression: "spick and span",
    koreanMeaning: "아주 깨끗한, 말끔한",
    movie: "To be confirmed",
  },
  {
    id: "exp-4",
    expression: "Hear me out",
    koreanMeaning: "내 이야기를 끝까지 들어봐",
    movie: "Minari",
  },
  {
    id: "exp-5",
    expression: "What if",
    koreanMeaning: "~라면 어떨까?",
    movie: "Inside Out 2",
  },
  {
    id: "exp-6",
    expression: "Let me show you",
    koreanMeaning: "내가 보여줄게",
    movie: "Notting Hill",
  },
  {
    id: "exp-7",
    expression: "I've changed my mind",
    koreanMeaning: "생각이 바뀌었어",
    movie: "Notting Hill",
  },
  {
    id: "exp-8",
    expression: "I'm so sorry",
    koreanMeaning: "정말 미안해",
    movie: "Inside Out 2",
  },
  {
    id: "exp-9",
    expression: "forgive",
    koreanMeaning: "용서하다",
    movie: "Inside Out 2",
  },
  {
    id: "exp-10",
    expression: "No worries",
    koreanMeaning: "괜찮아, 걱정하지 마",
    movie: "Inside Out 2",
  },
];

export const DEFAULT_SCENE_SETTINGS: SceneSettings = {
  title: "The Little Dot",
  place:
    "A minimalist three-dimensional world inspired by a large, clean sheet of warm ivory drawing paper with a subtle natural fiber texture. The surrounding environment is bright, simple, and spacious.",
  pencilCharacter:
    "A vivid yellow (#F5C518) hexagonal wooden pencil with a realistically sharpened wooden tip, dark graphite lead, a smooth slightly glossy painted wood surface, and only two small expressive eyes (no arms, legs, eyebrows, or mouth). Moves by tilting, rotating, pivoting, and gliding to place graphite dots and connect them into a flower.",
  eraserCharacter:
    "A saturated cobalt-blue (#2449D8) rectangular rubber eraser with softly rounded edges, a realistic matte rubber texture, and only two small expressive eyes (no arms, legs, eyebrows, or mouth). Initially strict about keeping the paper clean, then gradually warm, understanding, and friendly.",
  situation:
    "The yellow pencil places a small graphite dot on clean ivory paper. The cobalt-blue eraser thinks it is a mistake and tries to remove it, but the pencil adds scattered dots across the paper and gradually connects them with graphite lines. As the camera pulls back, the connected dots reveal an elegant flower. The eraser apologizes, and together they complete the artwork.",
  theme:
    "Every beautiful creation can begin with a little dot, and something considered a mistake can become something meaningful.",
  style: "Artistic cinematic 3D animation",
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
      "Begin with a perfectly clean sheet of warm ivory paper. A vivid yellow pencil enters the frame, gently tilts forward, and places a single small graphite dot on the paper. A cobalt-blue eraser slides into the scene and notices the unexpected dot. The eraser narrows its eyes and moves toward the dot with a slightly annoyed expression. The pencil looks at the eraser with curiosity.",
    cameraDirection:
      "Begin with a cinematic macro shot of the sharpened graphite tip touching the paper. Emphasize the realistic paper texture and the appearance of the first graphite dot. Gradually widen the frame to reveal the yellow pencil and cobalt-blue eraser, highlighting their strong color contrast.",
    lightingDirection:
      "Soft directional studio lighting across warm ivory paper with crisp natural shadows and subtle wood lacquer reflections.",
    musicDirection:
      "Background Music 1 — Curiosity (90 BPM): Minimalist four-note melody (C4, E4, D4, G4) on soft piano and subtle pizzicato, synced with the pencil's first tap.",
    soundEffects:
      "A soft tapping sound when the pencil touches the paper; gentle rubber friction as the eraser enters the scene.",
    lines: [
      {
        id: "b1-l1",
        speaker: "Eraser",
        text: "Oops! What's this little black dot? You don't belong here. I must keep this paper spick and span.",
      },
    ],
    koreanMeaning:
      "지우개: 앗! 이 작은 검은 점은 뭐지? 넌 여기에 있으면 안 돼. 나는 이 종이를 아주 깨끗하게 유지해야 해.",
    learningExpressions: ["Oops", "belong here", "spick and span"],
  },
  {
    id: "beat-2",
    number: 2,
    title: "Problem",
    startSec: 7,
    endSec: 15,
    durationSec: 8,
    sceneDescription:
      "The eraser attempts to remove the graphite dot. The pencil quickly moves across the paper and begins creating more individual graphite dots in different positions. The eraser follows, trying to remove the marks. The dots initially appear scattered and meaningless, secretly forming a flower outline without revealing it yet. The pencil expresses nervousness through quick eye movements, blinking, and body tilting.",
    cameraDirection:
      "Use smooth tracking shots to follow the pencil and eraser, with close-ups of the pencil tip tapping individual graphite dots. Use low camera angles and cropped compositions to hide the overall flower pattern while building rhythmic movement and tension.",
    lightingDirection:
      "Crisp studio key light accentuating the glossy yellow hexagonal facets, matte blue rubber, and dark graphite dots.",
    musicDirection:
      "Continue Background Music 1 — Curiosity: Repeat C4, E4, D4, G4 with playful rhythmic variations on soft piano and pizzicato, gradually accelerating from 90 to 120 BPM as the eraser chases the pencil's taps.",
    soundEffects:
      "Rhythmic graphite tapping sounds synchronized with the music tempo, soft pencil movement sounds, and rubber sliding across the paper.",
    lines: [
      {
        id: "b2-l1",
        speaker: "Pencil",
        text: "Hear me out! Please don't erase my dots. What if they could become something beautiful? Let me show you.",
      },
    ],
    koreanMeaning:
      "연필: 내 말 좀 들어봐! 제발 내가 찍은 점들을 지우지 마. 이 점들이 아름다운 무언가가 될 수 있다면? 내가 보여줄게.",
    learningExpressions: ["Hear me out", "What if", "Let me show you"],
  },
  {
    id: "beat-3",
    number: 3,
    title: "Turn",
    startSec: 15,
    endSec: 23,
    durationSec: 8,
    sceneDescription:
      "The pencil stops creating new dots and begins connecting the existing graphite dots one by one with thin, organic graphite lines. The eraser stops moving and watches. The camera slowly rises into an overhead view, revealing that the connected dots form a refined, artistic flower with petals, a stem, and leaves. The eraser opens its eyes wider in surprise and admiration.",
    cameraDirection:
      "Begin with an extreme close-up of the graphite tip connecting two dots. Follow the continuous movement of the pencil as the flower develops, then slowly rise into an overhead wide shot to reveal the complete flower as the visual climax.",
    lightingDirection:
      "Introduce slightly warmer golden studio lighting during the overhead flower reveal while maintaining original vivid character colors.",
    musicDirection:
      "Crossfade smoothly at 15s into Background Music 2 — Blooming (75 BPM): Simple ascending melody (C4, E4, G4, C5) on soft piano, gentle xylophone, and subtle bells, peaking with a delicate high note at the flower reveal.",
    soundEffects:
      "Soft graphite scratching sounds, subtle paper friction, and a gentle musical accent when the flower is revealed.",
    lines: [
      {
        id: "b3-l1",
        speaker: "Eraser",
        text: "Wow! Is that a flower? I've changed my mind. You made something beautiful from a mistake.",
      },
    ],
    koreanMeaning:
      "지우개: 와! 저거 꽃이야? 생각이 바뀌었어. 넌 실수에서 아름다운 것을 만들어 냈구나.",
    learningExpressions: ["I've changed my mind"],
  },
  {
    id: "beat-4",
    number: 4,
    title: "Close",
    startSec: 23,
    endSec: 30,
    durationSec: 7,
    sceneDescription:
      "The cobalt-blue eraser gently removes unnecessary graphite marks around the flower without damaging the artwork. The yellow pencil adds the final detail to the flower. The eraser looks toward the pencil and gently tilts its body in apology; the pencil responds with relaxed eye movements. Finally, both remain beside the completed flower in a minimalist art-print composition.",
    cameraDirection:
      "Slowly pull the camera back to reveal the completed artwork in a balanced composition featuring the yellow pencil, cobalt-blue eraser, and graphite flower with generous negative space.",
    lightingDirection:
      "Warm studio lighting, realistic soft shadows, and calm ambient highlights across the finished drawing paper.",
    musicDirection:
      "Continue Background Music 2 — Blooming: Soft piano, gentle xylophone, and subtle bells slow down gracefully during the apology and end on a gentle, sustained final note.",
    soundEffects:
      "Gentle erasing sounds, soft graphite drawing sounds, and subtle paper friction.",
    lines: [
      {
        id: "b4-l1",
        speaker: "Eraser",
        text: "I'm so sorry. Can you forgive me?",
      },
      {
        id: "b4-l2",
        speaker: "Pencil",
        text: "No worries! Let's make something beautiful together.",
      },
    ],
    koreanMeaning:
      "지우개: 정말 미안해. 나를 용서해 줄 수 있어?\n연필: 괜찮아! 우리 함께 아름다운 것을 만들자.",
    learningExpressions: ["I'm so sorry", "forgive", "No worries"],
  },
];

export const ANIMATION_STYLES = [
  "Artistic cinematic 3D animation",
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
