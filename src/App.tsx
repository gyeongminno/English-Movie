import { useState } from "react";
import { ExpressionsScreen } from "./components/ExpressionsScreen";
import { FinalScreen } from "./components/FinalScreen";
import { SceneScreen } from "./components/SceneScreen";
import { StoryboardScreen } from "./components/StoryboardScreen";
import { TopNav } from "./components/TopNav";
import { VideoScreen } from "./components/VideoScreen";
import {
  DEFAULT_BEATS,
  DEFAULT_EXPRESSIONS,
  DEFAULT_SCENE_SETTINGS,
  countTotalScriptWords,
} from "./data/defaults";
import type {
  Beat,
  ExpressionItem,
  GeneratedVideoPackage,
  SceneSettings,
  ScreenId,
} from "./types";

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function syncBeatsWithExpressions(
  prevExprs: ExpressionItem[],
  nextExprs: ExpressionItem[],
  currentBeats: Beat[]
): Beat[] {
  const prevById = new Map(prevExprs.map((e) => [e.id, e]));
  const nextById = new Map(nextExprs.map((e) => [e.id, e]));

  let updatedBeats = currentBeats.map((b) => ({
    ...b,
    lines: b.lines.map((l) => ({ ...l })),
    learningExpressions: [...b.learningExpressions],
  }));

  // 1. Handle modified expressions (replace inline in dialogue & learningExpressions)
  for (const nextItem of nextExprs) {
    const prevItem = prevById.get(nextItem.id);
    if (!prevItem) continue;

    const oldPhrase = prevItem.expression.trim();
    const newPhrase = nextItem.expression.trim();
    if (!oldPhrase || oldPhrase === newPhrase) continue;

    if (newPhrase.length > 0) {
      const candidateBeats = updatedBeats.map((b) => {
        const regex = new RegExp(`\\b${escapeRegExp(oldPhrase)}\\b`, "gi");
        const fallbackRegex = new RegExp(escapeRegExp(oldPhrase), "gi");
        return {
          ...b,
          learningExpressions: b.learningExpressions.map((le) =>
            le.trim().toLowerCase() === oldPhrase.toLowerCase() ? newPhrase : le
          ),
          lines: b.lines.map((l) => ({
            ...l,
            text: regex.test(l.text)
              ? l.text.replace(regex, newPhrase)
              : l.text.replace(fallbackRegex, newPhrase),
          })),
        };
      });

      const candidateCount = countTotalScriptWords(candidateBeats);
      if (candidateCount >= 55 && candidateCount <= 75) {
        updatedBeats = candidateBeats;
      } else {
        // Always update expression tags even if an unusually long phrase exceeds bounds
        updatedBeats = updatedBeats.map((b) => ({
          ...b,
          learningExpressions: b.learningExpressions.map((le) =>
            le.trim().toLowerCase() === oldPhrase.toLowerCase() ? newPhrase : le
          ),
        }));
      }
    }
  }

  // 2. Handle deleted expressions (detach from learningExpressions)
  for (const prevItem of prevExprs) {
    if (nextById.has(prevItem.id)) continue;
    const removedPhrase = prevItem.expression.trim().toLowerCase();
    if (!removedPhrase) continue;
    updatedBeats = updatedBeats.map((b) => ({
      ...b,
      learningExpressions: b.learningExpressions.filter(
        (le) => le.trim().toLowerCase() !== removedPhrase
      ),
    }));
  }

  // 3. Attach newly added/filled expressions to the beat with fewest tags
  const assignedLower = new Set(
    updatedBeats.flatMap((b) =>
      b.learningExpressions.map((le) => le.trim().toLowerCase())
    )
  );

  for (const nextItem of nextExprs) {
    const phrase = nextItem.expression.trim();
    if (!phrase || assignedLower.has(phrase.toLowerCase())) continue;

    let targetIdx = 0;
    let minCount = Infinity;
    updatedBeats.forEach((b, idx) => {
      if (b.learningExpressions.length < minCount) {
        minCount = b.learningExpressions.length;
        targetIdx = idx;
      }
    });

    updatedBeats[targetIdx] = {
      ...updatedBeats[targetIdx],
      learningExpressions: [...updatedBeats[targetIdx].learningExpressions, phrase],
    };
    assignedLower.add(phrase.toLowerCase());
  }

  return updatedBeats;
}

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>("input");
  const [expressions, setExpressions] = useState<ExpressionItem[]>(() =>
    DEFAULT_EXPRESSIONS.map((e) => ({ ...e }))
  );
  const [scene, setScene] = useState<SceneSettings>(() => ({
    ...DEFAULT_SCENE_SETTINGS,
  }));
  const [beats, setBeats] = useState<Beat[]>(() =>
    DEFAULT_BEATS.map((b) => ({
      ...b,
      lines: b.lines.map((l) => ({ ...l })),
      learningExpressions: [...b.learningExpressions],
    }))
  );
  const [videoPackage, setVideoPackage] =
    useState<GeneratedVideoPackage | null>(null);

  const [voiceVolume, setVoiceVolume] = useState<number>(1.0);
  const [musicVolume, setMusicVolume] = useState<number>(0.45);

  const handleSelectScreen = (screen: ScreenId) => {
    setActiveScreen(screen);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleChangeExpressions = (nextExpressions: ExpressionItem[]) => {
    const syncedBeats = syncBeatsWithExpressions(
      expressions,
      nextExpressions,
      beats
    );
    setExpressions(nextExpressions);
    setBeats(syncedBeats);
    setVideoPackage(null);
  };

  const handleResetExpressions = () => {
    const resetExprs = DEFAULT_EXPRESSIONS.map((e) => ({ ...e }));
    const syncedBeats = syncBeatsWithExpressions(
      expressions,
      resetExprs,
      DEFAULT_BEATS.map((b) => ({
        ...b,
        lines: b.lines.map((l) => ({ ...l })),
        learningExpressions: [...b.learningExpressions],
      }))
    );
    setExpressions(resetExprs);
    setBeats(syncedBeats);
    setVideoPackage(null);
  };

  const handleChangeBeats = (nextBeats: Beat[]) => {
    setBeats(nextBeats);
    setVideoPackage(null);
  };

  const handleChangeScene = (nextScene: SceneSettings) => {
    setScene(nextScene);
    if (videoPackage && videoPackage.style !== nextScene.style) {
      setVideoPackage({ ...videoPackage, style: nextScene.style });
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7EF] text-[#242424] flex flex-col">
      <TopNav
        activeScreen={activeScreen}
        onSelectScreen={handleSelectScreen}
        hasGeneratedVideo={videoPackage !== null}
      />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-24 md:pb-12">
        {activeScreen === "input" && (
          <ExpressionsScreen
            expressions={expressions}
            onChange={handleChangeExpressions}
            onResetDefaults={handleResetExpressions}
            onContinue={() => handleSelectScreen("scene")}
          />
        )}

        {activeScreen === "scene" && (
          <SceneScreen
            scene={scene}
            onChange={handleChangeScene}
            onResetDefaults={() => setScene({ ...DEFAULT_SCENE_SETTINGS })}
            onContinue={() => handleSelectScreen("storyboard")}
          />
        )}

        {activeScreen === "storyboard" && (
          <StoryboardScreen
            beats={beats}
            expressions={expressions}
            scene={scene}
            onChangeBeats={handleChangeBeats}
            onResetDefaults={() =>
              handleChangeBeats(
                DEFAULT_BEATS.map((b) => ({
                  ...b,
                  lines: b.lines.map((l) => ({ ...l })),
                  learningExpressions: [...b.learningExpressions],
                }))
              )
            }
            onContinue={() => handleSelectScreen("video")}
          />
        )}

        {activeScreen === "video" && (
          <VideoScreen
            beats={beats}
            scene={scene}
            videoPackage={videoPackage}
            voiceVolume={voiceVolume}
            musicVolume={musicVolume}
            onChangeVoiceVolume={setVoiceVolume}
            onChangeMusicVolume={setMusicVolume}
            onVideoGenerated={(pkg) => setVideoPackage(pkg)}
            onUpdateMode={(mode) => {
              if (videoPackage) {
                setVideoPackage({ ...videoPackage, mode });
              }
            }}
            onContinue={() => handleSelectScreen("final")}
          />
        )}

        {activeScreen === "final" && (
          <FinalScreen
            beats={beats}
            expressions={expressions}
            scene={scene}
            videoPackage={videoPackage}
            voiceVolume={voiceVolume}
            musicVolume={musicVolume}
            onChangeVoiceVolume={setVoiceVolume}
            onChangeMusicVolume={setMusicVolume}
            onChangeBeats={setBeats}
            onVideoGenerated={(pkg) => setVideoPackage(pkg)}
            onGoToVideo={() => handleSelectScreen("video")}
          />
        )}
      </main>
    </div>
  );
}
