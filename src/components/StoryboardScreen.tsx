import {
  AlertCircle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Edit3,
  Loader2,
  Music,
  Plus,
  RefreshCw,
  RotateCcw,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  countBeatWords,
  countTotalScriptWords,
  splitSubtitleSegments,
} from "../data/defaults";
import type { Beat, ExpressionItem, SceneSettings } from "../types";

interface StoryboardScreenProps {
  beats: Beat[];
  expressions: ExpressionItem[];
  scene: SceneSettings;
  onChangeBeats: (next: Beat[]) => void;
  onResetDefaults: () => void;
  onContinue: () => void;
}

export function StoryboardScreen({
  beats,
  expressions,
  scene,
  onChangeBeats,
  onResetDefaults,
  onContinue,
}: StoryboardScreenProps) {
  const [editingBeatId, setEditingBeatId] = useState<string | null>(null);
  const [regeneratingBeatId, setRegeneratingBeatId] = useState<string | null>(
    null
  );
  const [regenError, setRegenError] = useState<string | null>(null);
  const [selectedExpr, setSelectedExpr] = useState<ExpressionItem | null>(null);

  const totalWords = countTotalScriptWords(beats);
  const inWordRange = totalWords >= 60 && totalWords <= 70;

  const fullScriptLower = beats
    .flatMap((b) => b.lines.map((l) => l.text))
    .join(" ")
    .toLowerCase();

  const missingExpressions = expressions.filter(
    (e) =>
      e.expression.trim().length > 0 &&
      !fullScriptLower.includes(e.expression.trim().toLowerCase())
  );

  const renderHighlightedText = (text: string): ReactNode => {
    const activeExprs = expressions
      .filter((e) => e.expression.trim().length > 0)
      .sort((a, b) => b.expression.length - a.expression.length);

    if (activeExprs.length === 0) return text;

    const escaped = activeExprs.map((e) =>
      e.expression.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    );
    const regex = new RegExp(`(${escaped.join("|")})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, idx) => {
      const matched = activeExprs.find(
        (e) => e.expression.trim().toLowerCase() === part.toLowerCase()
      );
      if (!matched) return <span key={idx}>{part}</span>;

      const isSelected = selectedExpr?.id === matched.id;
      return (
        <button
          key={idx}
          type="button"
          onClick={() => setSelectedExpr(matched)}
          title="Click to inspect Korean meaning & source movie"
          className={`inline font-bold px-1.5 py-0.5 rounded-md transition-colors cursor-pointer underline decoration-[#D99A70]/60 underline-offset-2 ${
            isSelected
              ? "bg-[#D99A70] text-white"
              : "bg-[#F7E4D4] text-[#8F4D22] hover:bg-[#F1D4BA]"
          }`}
        >
          {part}
        </button>
      );
    });
  };

  const handleRegenerateBeat = async (beat: Beat) => {
    setRegenError(null);
    setRegeneratingBeatId(beat.id);
    try {
      const summary = beats
        .map(
          (b) =>
            `Beat ${b.number} (${b.title}, ${b.startSec}-${b.endSec}s): ${b.sceneDescription}`
        )
        .join("\n");

      const res = await fetch("/api/regenerate-beat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beatNumber: beat.number,
          beatTitle: beat.title,
          startSec: beat.startSec,
          endSec: beat.endSec,
          learningExpressions: beat.learningExpressions,
          sceneSettings: scene,
          otherBeatsSummary: summary,
          currentWordCount: countBeatWords(beat),
          totalScriptWordCount: totalWords,
          currentCameraDirection: beat.cameraDirection,
          currentLightingDirection: beat.lightingDirection,
          currentMusicDirection: beat.musicDirection,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        sceneDescription?: string;
        lines?: Array<{ speaker: "Square" | "Circle"; text: string }>;
        koreanMeaning?: string;
        cameraDirection?: string;
        lightingDirection?: string;
        musicDirection?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || "Could not regenerate beat.");
      }

      if (!data.lines || data.lines.length === 0) {
        throw new Error("Regenerated beat contained no dialogue.");
      }

      onChangeBeats(
        beats.map((b) =>
          b.id === beat.id
            ? {
                ...b,
                sceneDescription:
                  data.sceneDescription || b.sceneDescription,
                cameraDirection:
                  data.cameraDirection || b.cameraDirection,
                lightingDirection:
                  data.lightingDirection || b.lightingDirection,
                musicDirection:
                  data.musicDirection || b.musicDirection,
                lines: data.lines!.map((l, i) => ({
                  id: `${b.id}-regen-${Date.now()}-${i}`,
                  speaker: l.speaker,
                  text: l.text,
                })),
                koreanMeaning: data.koreanMeaning || b.koreanMeaning,
              }
            : b
        )
      );
    } catch (err) {
      setRegenError(
        err instanceof Error ? err.message : "Failed to regenerate beat."
      );
    } finally {
      setRegeneratingBeatId(null);
    }
  };

  const updateBeatField = (
    beatId: string,
    updater: (beat: Beat) => Beat
  ) => {
    onChangeBeats(beats.map((b) => (b.id === beatId ? updater(b) : b)));
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-[#75726B]">
            Step 3 of 5 · 4-Beat Script & Direction
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#484744] text-balance">
            Storyboard, Camera & Score
          </h1>
          <p className="text-sm sm:text-base text-[#66645F] max-w-2xl">
            Inspect or edit dialogue, camera framing, lighting mood, and
            musical direction for each beat. Tap any highlighted expression for
            its Korean meaning and movie.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div
            className={`px-3.5 py-2 rounded-xl border text-sm font-medium inline-flex items-center gap-2 ${
              inWordRange
                ? "bg-[#EBF0EA] border-[#A4B5A0] text-[#3F533B]"
                : "bg-[#FAF0E8] border-[#D99A70] text-[#6E4427]"
            }`}
          >
            {inWordRange ? (
              <CheckCircle2 className="w-4 h-4 text-[#6F876B]" />
            ) : (
              <AlertCircle className="w-4 h-4 text-[#C27849]" />
            )}
            <span className="font-mono-tabular font-semibold">
              {totalWords} words
            </span>
            <span className="text-xs opacity-85">(Target: 60–70)</span>
          </div>

          <button
            type="button"
            onClick={onResetDefaults}
            className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#D8D2C7] bg-white/85 text-sm font-medium text-[#5C5A55] hover:bg-[#EAE4D8] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Script</span>
          </button>
        </div>
      </div>

      {selectedExpr && (
        <div
          role="region"
          aria-label="Selected expression details"
          className="rounded-2xl border border-[#D99A70] bg-[#FBF4EE] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
        >
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#7D5E44]">
              <span>Learning Expression</span>
              <span aria-hidden="true">·</span>
              <span>Movie: {selectedExpr.movie || "Custom"}</span>
            </div>
            <p className="font-display text-xl font-bold text-[#484744]">
              “{selectedExpr.expression}”
            </p>
            <p className="text-base font-medium text-[#6B533F]">
              한국어 뜻: {selectedExpr.koreanMeaning}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedExpr(null)}
            aria-label="Close expression details"
            className="min-h-[44px] min-w-[44px] self-start sm:self-center inline-flex items-center justify-center rounded-xl text-[#7D5E44] hover:bg-[#F3E2D4] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {missingExpressions.length > 0 && (
        <div className="rounded-2xl border border-[#D99A70] bg-[#FAF0E8] p-4 text-sm text-[#6E4427]">
          Missing from dialogue:{" "}
          <span className="font-semibold">
            {missingExpressions.map((e) => e.expression).join(", ")}
          </span>
          . Include all expressions in your beats before generating the film.
        </div>
      )}

      {regenError && (
        <div className="rounded-2xl border border-[#DC8A7E] bg-[#FDF0EE] p-4 text-sm text-[#7D2B20] flex items-center justify-between gap-3">
          <span>{regenError}</span>
          <button
            type="button"
            onClick={() => setRegenError(null)}
            className="text-xs font-semibold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5">
        {beats.map((beat) => {
          const isEditing = editingBeatId === beat.id;
          const isRegenerating = regeneratingBeatId === beat.id;
          const beatWords = countBeatWords(beat);

          const subtitlePreviewLines = beat.lines.flatMap((line) =>
            splitSubtitleSegments(line.text, 0, 2).map((seg, idx) => ({
              id: `${line.id}-sub-${idx}`,
              speaker: line.speaker,
              lines: seg.lines,
            }))
          );

          return (
            <article
              key={beat.id}
              className="bg-white/90 border border-[#D8D2C7] rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#EAE4D8]">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs text-[#75726B]">
                    <span className="font-mono-tabular font-semibold">
                      {beat.startSec}–{beat.endSec}s ({beat.durationSec}s)
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">{beatWords} words</span>
                  </div>
                  <h2 className="font-display text-xl font-bold text-[#484744]">
                    Beat {beat.number}: {beat.title}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingBeatId(isEditing ? null : beat.id)
                    }
                    className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium border inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                      isEditing
                        ? "bg-[#484744] text-white border-[#484744]"
                        : "bg-[#FAF8F4] text-[#484744] border-[#D4CEC2] hover:bg-[#EFEAE0]"
                    }`}
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>{isEditing ? "Done Editing" : "Edit Beat"}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isRegenerating}
                    onClick={() => handleRegenerateBeat(beat)}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[#EBF0EA] border border-[#B8C7B4] text-[#3F533B] text-sm font-semibold hover:bg-[#DFEAE0] disabled:opacity-60 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {isRegenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Regenerating...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        <span>Regenerate Beat</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-[#484744]">
                      Scene Description
                    </label>
                    <textarea
                      rows={3}
                      value={beat.sceneDescription}
                      onChange={(e) =>
                        updateBeatField(beat.id, (b) => ({
                          ...b,
                          sceneDescription: e.target.value,
                        }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4CEC2] bg-[#FAF8F4] text-sm sm:text-base text-[#484744]"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#5C5A55]">
                        Camera Direction
                      </label>
                      <textarea
                        rows={3}
                        value={beat.cameraDirection}
                        onChange={(e) =>
                          updateBeatField(beat.id, (b) => ({
                            ...b,
                            cameraDirection: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#D4CEC2] bg-[#FAF8F4] text-xs sm:text-sm text-[#484744]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#5C5A55]">
                        Lighting Direction
                      </label>
                      <textarea
                        rows={3}
                        value={beat.lightingDirection}
                        onChange={(e) =>
                          updateBeatField(beat.id, (b) => ({
                            ...b,
                            lightingDirection: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#D4CEC2] bg-[#FAF8F4] text-xs sm:text-sm text-[#484744]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#5C5A55]">
                        Background Music Direction
                      </label>
                      <textarea
                        rows={3}
                        value={beat.musicDirection}
                        onChange={(e) =>
                          updateBeatField(beat.id, (b) => ({
                            ...b,
                            musicDirection: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#D4CEC2] bg-[#FAF8F4] text-xs sm:text-sm text-[#484744]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-[#484744]">
                        English Dialogue Lines
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          updateBeatField(beat.id, (b) => ({
                            ...b,
                            lines: [
                              ...b.lines,
                              {
                                id: `${b.id}-l-${Date.now()}`,
                                speaker: "Square",
                                text: "",
                              },
                            ],
                          }))
                        }
                        className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#C5C0B8] text-xs font-semibold text-[#484744] hover:bg-[#EFEAE0] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Line</span>
                      </button>
                    </div>

                    {beat.lines.map((line) => (
                      <div
                        key={line.id}
                        className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center"
                      >
                        <select
                          value={line.speaker}
                          onChange={(e) =>
                            updateBeatField(beat.id, (b) => ({
                              ...b,
                              lines: b.lines.map((l) =>
                                l.id === line.id
                                  ? {
                                      ...l,
                                      speaker: e.target.value as
                                        | "Square"
                                        | "Circle",
                                    }
                                  : l
                              ),
                            }))
                          }
                          className="min-h-[44px] px-3 py-2 rounded-xl border border-[#D4CEC2] bg-[#FAF8F4] text-sm font-semibold text-[#484744]"
                        >
                          <option value="Square">Square</option>
                          <option value="Circle">Circle</option>
                        </select>

                        <input
                          type="text"
                          value={line.text}
                          onChange={(e) =>
                            updateBeatField(beat.id, (b) => ({
                              ...b,
                              lines: b.lines.map((l) =>
                                l.id === line.id
                                  ? { ...l, text: e.target.value }
                                  : l
                              ),
                            }))
                          }
                          className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D4CEC2] bg-[#FAF8F4] text-sm sm:text-base text-[#484744]"
                        />

                        {beat.lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              updateBeatField(beat.id, (b) => ({
                                ...b,
                                lines: b.lines.filter((l) => l.id !== line.id),
                              }))
                            }
                            aria-label="Delete dialogue line"
                            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-[#7A7770] hover:text-[#B55442] hover:bg-[#F9EAE6] cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-[#484744]">
                      Korean Meaning (한국어 해석)
                    </label>
                    <textarea
                      rows={2}
                      value={beat.koreanMeaning}
                      onChange={(e) =>
                        updateBeatField(beat.id, (b) => ({
                          ...b,
                          koreanMeaning: e.target.value,
                        }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4CEC2] bg-[#FAF8F4] text-sm sm:text-base text-[#484744]"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    <div className="lg:col-span-7 space-y-4">
                      <div>
                        <p className="text-xs font-semibold text-[#75726B] mb-1">
                          Scene Description
                        </p>
                        <p className="text-sm sm:text-base text-[#484744] leading-relaxed">
                          {beat.sceneDescription}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-[#75726B]">
                          English Dialogue (tap highlighted expressions)
                        </p>
                        <div className="space-y-2 bg-[#F8F5EE] border border-[#E6E0D5] rounded-xl p-4">
                          {beat.lines.map((line) => (
                            <p
                              key={line.id}
                              className="text-sm sm:text-base text-[#484744] leading-relaxed"
                            >
                              <span
                                className={`font-bold mr-2 ${
                                  line.speaker === "Square"
                                    ? "text-[#B56E42]"
                                    : "text-[#5E7859]"
                                }`}
                              >
                                {line.speaker}:
                              </span>
                              “{renderHighlightedText(line.text)}”
                            </p>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-[#75726B] mb-1">
                          Korean Meaning
                        </p>
                        <p className="text-sm text-[#66645F] whitespace-pre-line leading-relaxed">
                          {beat.koreanMeaning}
                        </p>
                      </div>
                    </div>

                    <div className="lg:col-span-5 space-y-4">
                      <div>
                        <p className="text-xs font-semibold text-[#75726B] mb-1.5">
                          English Subtitles (max 2 lines per cue)
                        </p>
                        <div className="bg-[#484744] rounded-xl p-4 space-y-2.5">
                          {subtitlePreviewLines.map((sub) => (
                            <div
                              key={sub.id}
                              className="text-center border-b border-white/10 last:border-b-0 pb-2 last:pb-0"
                            >
                              {sub.lines.map((l, i) => (
                                <p
                                  key={i}
                                  className="text-white font-bold text-sm leading-snug"
                                >
                                  {l}
                                </p>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-[#75726B] mb-1.5">
                          Learning Expressions in Beat {beat.number}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {beat.learningExpressions.map((exprText) => {
                            const found = expressions.find(
                              (e) =>
                                e.expression.trim().toLowerCase() ===
                                exprText.trim().toLowerCase()
                            );
                            return (
                              <button
                                key={exprText}
                                type="button"
                                onClick={() =>
                                  setSelectedExpr(
                                    found ?? {
                                      id: exprText,
                                      expression: exprText,
                                      koreanMeaning: beat.koreanMeaning,
                                      movie: "Story Script",
                                    }
                                  )
                                }
                                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#F7ECE3] border border-[#E5C2A8] text-[#8F4D22] text-sm font-semibold hover:bg-[#F2DFD0] transition-colors cursor-pointer"
                              >
                                {exprText}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Camera, Lighting & Background Music Direction Row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-[#EAE4D8] text-xs sm:text-sm">
                    <div className="bg-[#FAF8F4] border border-[#E6E0D5] rounded-xl p-3.5 space-y-1">
                      <p className="font-semibold text-[#484744] inline-flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-[#75726B]" />
                        <span>Camera Direction</span>
                      </p>
                      <p className="text-[#66645F] leading-relaxed">
                        {beat.cameraDirection}
                      </p>
                    </div>

                    <div className="bg-[#FAF8F4] border border-[#E6E0D5] rounded-xl p-3.5 space-y-1">
                      <p className="font-semibold text-[#484744] inline-flex items-center gap-1.5">
                        <Sun className="w-3.5 h-3.5 text-[#C27849]" />
                        <span>Lighting Direction</span>
                      </p>
                      <p className="text-[#66645F] leading-relaxed">
                        {beat.lightingDirection}
                      </p>
                    </div>

                    <div className="bg-[#FAF8F4] border border-[#E6E0D5] rounded-xl p-3.5 space-y-1">
                      <p className="font-semibold text-[#484744] inline-flex items-center gap-1.5">
                        <Music className="w-3.5 h-3.5 text-[#6F876B]" />
                        <span>Background Music</span>
                      </p>
                      <p className="text-[#66645F] leading-relaxed">
                        {beat.musicDirection}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          className="w-full sm:w-auto min-h-[50px] px-7 py-3 rounded-xl bg-[#D99A70] text-white text-base font-semibold hover:bg-[#C6865B] active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs"
        >
          <span>Continue to 3D Film & Soundtrack</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
}
