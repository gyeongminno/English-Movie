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
} from "./data/defaults";
import type {
  Beat,
  ExpressionItem,
  GeneratedVideoPackage,
  SceneSettings,
  ScreenId,
} from "./types";

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
  const [musicVolume, setMusicVolume] = useState<number>(0.42);

  const handleSelectScreen = (screen: ScreenId) => {
    setActiveScreen(screen);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    <div className="min-h-screen bg-[#F2EEE6] text-[#484744] flex flex-col">
      <TopNav
        activeScreen={activeScreen}
        onSelectScreen={handleSelectScreen}
        hasGeneratedVideo={videoPackage !== null}
      />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-24 md:pb-12">
        {activeScreen === "input" && (
          <ExpressionsScreen
            expressions={expressions}
            onChange={setExpressions}
            onResetDefaults={() =>
              setExpressions(DEFAULT_EXPRESSIONS.map((e) => ({ ...e })))
            }
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
