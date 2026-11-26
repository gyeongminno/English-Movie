export type ScreenId = "input" | "scene" | "storyboard" | "video" | "final";

export type AnimationStyle =
  | "Artistic cinematic 3D animation"
  | "Minimalist 3D motion graphics"
  | "2D animation"
  | "Clay"
  | "Watercolor"
  | "Live-action style";

export interface ExpressionItem {
  id: string;
  expression: string;
  koreanMeaning: string;
  movie: string;
}

export interface SceneSettings {
  title: string;
  place: string;
  pencilCharacter: string;
  eraserCharacter: string;
  situation: string;
  theme: string;
  style: AnimationStyle;
}

export type SpeakerRole = "Pencil" | "Eraser";

export type VoiceId = "PENCIL_VOICE" | "ERASER_VOICE";

export interface DialogueLine {
  id: string;
  speaker: SpeakerRole;
  text: string;
}

export interface Beat {
  id: string;
  number: 1 | 2 | 3 | 4;
  title: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  sceneDescription: string;
  cameraDirection: string;
  lightingDirection: string;
  musicDirection: string;
  soundEffects: string;
  lines: DialogueLine[];
  koreanMeaning: string;
  learningExpressions: string[];
}

export interface WordTimestamp {
  word: string;
  startSec: number;
  endSec: number;
}

export interface TimedSubtitleSegment {
  id: string;
  lineId: string;
  beatNumber: 1 | 2 | 3 | 4;
  speaker: SpeakerRole;
  voiceId: VoiceId;
  text: string;
  displayLines: string[];
  koreanTranslation: string;
  startSec: number;
  endSec: number;
  words: WordTimestamp[];
}

export interface MasterTimelineMarkers {
  totalDurationSec: 30;
  dot1TapSec: number;
  eraserArriveStartSec: number;
  eraserNoticeDotSec: number;
  beat1EndSec: number;
  beat2StartSec: number;
  beat2SpeechStartSec: number;
  beat2SpeechEndSec: number;
  beat2DotTimes: number[];
  beat3StartSec: number;
  eraserAmazedSec: number;
  flowerRevealPeakSec: number;
  beat3SpeechEndSec: number;
  beat4StartSec: number;
  apologyStartSec: number;
  apologyEndSec: number;
  pencilRespondSec: number;
  pencilRespondEndSec: number;
  creditStartSec: number;
}

export interface TimedLine {
  lineId: string;
  beatNumber: 1 | 2 | 3 | 4;
  speaker: SpeakerRole;
  voiceId: VoiceId;
  text: string;
  koreanTranslation: string;
  startSec: number;
  endSec: number;
  trimStartSec: number;
  trimEndSec: number;
  rawDurationSec: number;
  playbackRate: number;
  segments: TimedSubtitleSegment[];
  audioBuffer: AudioBuffer | null;
  sourceMode: "gemini-tts" | "silent-timed";
}

export interface GeneratedVideoPackage {
  generatedAt: number;
  style: AnimationStyle;
  mode: "3d-animation" | "3d-slideshow";
  timedLines: TimedLine[];
  timedSegments: TimedSubtitleSegment[];
  timelineMarkers: MasterTimelineMarkers;
  musicBuffer: AudioBuffer;
  track1Buffer: AudioBuffer;
  track2Buffer: AudioBuffer;
  musicSeed: number;
  musicSourceLabel: string;
  totalDurationSec: 30;
  ttsErrorNotice?: string;
}
