import { ArrowRight, RotateCcw } from "lucide-react";
import { useEffect, useRef } from "react";
import { ANIMATION_STYLES, PALETTE } from "../data/defaults";
import type { AnimationStyle, SceneSettings } from "../types";
import { CANVAS_HEIGHT, CANVAS_WIDTH, renderFrame } from "../utils/canvasRenderer";
import { ThreeFilmStage } from "../utils/threeRenderer";

interface SceneScreenProps {
  scene: SceneSettings;
  onChange: (next: SceneSettings) => void;
  onResetDefaults: () => void;
  onContinue: () => void;
}

export function SceneScreen({
  scene,
  onChange,
  onResetDefaults,
  onContinue,
}: SceneScreenProps) {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<ThreeFilmStage | null>(null);
  const styleRef = useRef<AnimationStyle>(scene.style);
  styleRef.current = scene.style;

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    let use2D = false;
    try {
      const stage = new ThreeFilmStage(canvas);
      stage.setSize(960, 540);
      stageRef.current = stage;
    } catch {
      use2D = true;
    }

    let raf = 0;
    let timer = 0;
    const start = performance.now();
    const isSoft = stageRef.current?.isSoftwareGl ?? false;

    const tick = () => {
      const elapsed = ((performance.now() - start) / 1000) % 7;
      if (!use2D && stageRef.current) {
        stageRef.current.renderAtTime({
          timeSec: elapsed,
          style: styleRef.current,
          mode: "3d-animation",
          timedLines: [],
        });
      } else {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          renderFrame(ctx, {
            timeSec: elapsed,
            style: styleRef.current,
            mode: "animation",
            timedLines: [],
            drawSubtitles: false,
          });
        }
      }

      if (isSoft) {
        timer = window.setTimeout(() => {
          raf = requestAnimationFrame(tick);
        }, 70);
      } else {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      stageRef.current?.dispose();
      stageRef.current = null;
    };
  }, []);

  const updateField = <K extends keyof SceneSettings>(
    key: K,
    value: SceneSettings[K]
  ) => {
    onChange({ ...scene, [key]: value });
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-[#75726B]">
            Step 2 of 5 · 3D Art Direction & World
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#484744] text-balance">
            Scene, Characters & Style
          </h1>
          <p className="text-sm sm:text-base text-[#66645F] max-w-2xl">
            Configure the sculptural 3D world, ceramic-like matte characters,
            and contemporary motion-graphics aesthetic.
          </p>
        </div>

        <button
          type="button"
          onClick={onResetDefaults}
          className="min-h-[44px] px-4 py-2 rounded-xl border border-[#D8D2C7] bg-white/85 text-sm font-medium text-[#5C5A55] hover:bg-[#EAE4D8] inline-flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset Scene Defaults</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Live 3D Art Direction Viewport + Palette + 6 Styles */}
        <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-20">
          <div className="bg-white/85 border border-[#D8D2C7] rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-[#484744]">
                Live 3D Stage Preview
              </h2>
              <span className="text-xs font-medium text-[#75726B]">
                16:9 · {scene.style}
              </span>
            </div>

            <div className="rounded-xl overflow-hidden border border-[#D4CEC2] aspect-video bg-[#F2EEE6]">
              <canvas
                ref={previewCanvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="w-full h-full block"
              />
            </div>

            {/* Film Color Palette */}
            <div className="space-y-1.5 pt-1">
              <p className="text-xs font-semibold text-[#66645F]">
                Matte Ceramic Palette
              </p>
              <div className="grid grid-cols-5 gap-1.5 text-[11px] text-[#5C5A55]">
                {[
                  { label: "Ivory", hex: PALETTE.warmIvory },
                  { label: "Apricot", hex: PALETTE.apricotOrange },
                  { label: "Sage", hex: PALETTE.sageGreen },
                  { label: "Gray", hex: PALETTE.warmGray },
                  { label: "Charcoal", hex: PALETTE.softCharcoal },
                ].map((sw) => (
                  <div key={sw.hex} className="space-y-1 text-center">
                    <div
                      className="h-6 rounded-md border border-[#C5C0B8]/70"
                      style={{ backgroundColor: sw.hex }}
                    />
                    <span className="block truncate">{sw.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 6-Option Style Menu */}
            <div className="space-y-2 pt-1">
              <label className="block text-sm font-semibold text-[#484744]">
                Visual Style
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ANIMATION_STYLES.map((styleOption: AnimationStyle) => {
                  const selected = scene.style === styleOption;
                  return (
                    <button
                      key={styleOption}
                      type="button"
                      onClick={() => updateField("style", styleOption)}
                      className={`min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-medium border text-left transition-all cursor-pointer ${
                        selected
                          ? "bg-[#F7ECE3] border-[#D99A70] text-[#353431] font-semibold"
                          : "bg-[#FAF8F4] border-[#D8D2C7] text-[#5C5A55] hover:bg-[#EFEAE0]"
                      }`}
                    >
                      {styleOption}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Editable Scene & Character Specifications */}
        <div className="lg:col-span-7 bg-white/85 border border-[#D8D2C7] rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="scene-title"
                className="block text-sm font-semibold text-[#484744]"
              >
                Title
              </label>
              <input
                id="scene-title"
                type="text"
                value={scene.title}
                onChange={(e) => updateField("title", e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D4CEC2] bg-[#FAF8F4] text-base font-medium text-[#484744] focus:outline-none focus:border-[#D99A70]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="scene-theme"
                className="block text-sm font-semibold text-[#484744]"
              >
                Theme
              </label>
              <input
                id="scene-theme"
                type="text"
                value={scene.theme}
                onChange={(e) => updateField("theme", e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D4CEC2] bg-[#FAF8F4] text-base text-[#484744] focus:outline-none focus:border-[#D99A70]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="scene-place"
              className="block text-sm font-semibold text-[#484744]"
            >
              Place
            </label>
            <textarea
              id="scene-place"
              rows={2}
              value={scene.place}
              onChange={(e) => updateField("place", e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4CEC2] bg-[#FAF8F4] text-base text-[#484744] leading-relaxed focus:outline-none focus:border-[#D99A70]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="char-square"
                className="block text-sm font-semibold text-[#484744]"
              >
                Character: Square (3D Cube)
              </label>
              <textarea
                id="char-square"
                rows={4}
                value={scene.squareCharacter}
                onChange={(e) => updateField("squareCharacter", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4CEC2] bg-[#FAF8F4] text-sm sm:text-base text-[#484744] leading-relaxed focus:outline-none focus:border-[#D99A70]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="char-circles"
                className="block text-sm font-semibold text-[#484744]"
              >
                Characters: Circles (3D Spheres)
              </label>
              <textarea
                id="char-circles"
                rows={4}
                value={scene.circlesCharacter}
                onChange={(e) =>
                  updateField("circlesCharacter", e.target.value)
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4CEC2] bg-[#FAF8F4] text-sm sm:text-base text-[#484744] leading-relaxed focus:outline-none focus:border-[#D99A70]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="scene-situation"
              className="block text-sm font-semibold text-[#484744]"
            >
              Situation
            </label>
            <textarea
              id="scene-situation"
              rows={4}
              value={scene.situation}
              onChange={(e) => updateField("situation", e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4CEC2] bg-[#FAF8F4] text-sm sm:text-base text-[#484744] leading-relaxed focus:outline-none focus:border-[#D99A70]"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          className="w-full sm:w-auto min-h-[50px] px-7 py-3 rounded-xl bg-[#D99A70] text-white text-base font-semibold hover:bg-[#C6865B] active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs"
        >
          <span>Continue to Storyboard & Direction</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
}
