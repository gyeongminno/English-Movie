import { ArrowRight, BookOpen, Clapperboard, Film, Layers, Sparkles } from "lucide-react";
import type { ScreenId } from "../types";

interface TopNavProps {
  activeScreen: ScreenId;
  onSelectScreen: (screen: ScreenId) => void;
  hasGeneratedVideo: boolean;
}

const NAV_ITEMS: Array<{
  id: ScreenId;
  label: string;
  shortLabel: string;
  icon: typeof BookOpen;
}> = [
  { id: "input", label: "Expressions", shortLabel: "1. Input", icon: BookOpen },
  { id: "scene", label: "Scene", shortLabel: "2. Scene", icon: Layers },
  { id: "storyboard", label: "Storyboard", shortLabel: "3. Script", icon: Sparkles },
  { id: "video", label: "Video", shortLabel: "4. Video", icon: Clapperboard },
  { id: "final", label: "Final", shortLabel: "5. Final", icon: Film },
];

export function TopNav({
  activeScreen,
  onSelectScreen,
  hasGeneratedVideo,
}: TopNavProps) {
  const currentIdx = NAV_ITEMS.findIndex((item) => item.id === activeScreen);
  const nextItem =
    currentIdx < NAV_ITEMS.length - 1 ? NAV_ITEMS[currentIdx + 1] : null;

  return (
    <>
      <header className="sticky top-0 z-30 bg-[#F2EEE6]/95 backdrop-blur-md border-b border-[#D8D2C7]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => onSelectScreen("input")}
            className="font-display text-lg sm:text-xl font-bold tracking-tight text-[#484744] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D99A70]"
          >
            Shape of Me
          </button>

          {/* Zone 2: 5-step progress navigation */}
          <nav
            aria-label="5-step short-film studio"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {NAV_ITEMS.map((item, idx) => {
              const isActive = item.id === activeScreen;
              const isDone = idx < currentIdx;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectScreen(item.id)}
                  className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D99A70] ${
                    isActive
                      ? "border-[#D99A70] text-[#2F2E2B] font-semibold"
                      : isDone
                      ? "border-[#A4B5A0]/60 text-[#484744] hover:text-[#2F2E2B]"
                      : "border-transparent text-[#78756E] hover:text-[#484744] hover:border-[#C5C0B8]"
                  }`}
                >
                  {idx + 1}. {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single primary action */}
          <div className="flex items-center shrink-0">
            {nextItem ? (
              <button
                type="button"
                onClick={() => onSelectScreen(nextItem.id)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#484744] text-[#F2EEE6] text-xs sm:text-sm font-semibold hover:bg-[#383734] active:scale-[0.98] transition-all inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Next: {nextItem.label}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSelectScreen("video")}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#6F876B] text-white text-xs sm:text-sm font-semibold hover:bg-[#5E745A] active:scale-[0.98] transition-all inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{hasGeneratedVideo ? "Studio Settings" : "Build 3D Film"}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile bottom thumb bar (compact <= 56px) */}
      <nav
        aria-label="Mobile 5-step navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#F2EEE6]/95 backdrop-blur-md border-t border-[#D8D2C7]"
      >
        <div className="grid grid-cols-5 h-14">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeScreen;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectScreen(item.id)}
                className={`flex flex-col items-center justify-center min-h-[44px] transition-colors cursor-pointer ${
                  isActive ? "text-[#B56E42] font-semibold" : "text-[#78756E]"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] leading-tight mt-0.5 whitespace-nowrap">
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
