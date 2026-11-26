import { AlertTriangle, ArrowRight, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { ExpressionItem } from "../types";

interface ExpressionsScreenProps {
  expressions: ExpressionItem[];
  onChange: (next: ExpressionItem[]) => void;
  onResetDefaults: () => void;
  onContinue: () => void;
}

export function ExpressionsScreen({
  expressions,
  onChange,
  onResetDefaults,
  onContinue,
}: ExpressionsScreenProps) {
  const filledExpressions = expressions.filter(
    (item) => item.expression.trim().length > 0
  );
  const uniqueMovies = new Set(
    filledExpressions
      .map((item) => item.movie.trim().toLowerCase())
      .filter((m) => m.length > 0 && m !== "to be confirmed")
  );

  const tooFewExpressions = filledExpressions.length < 5;
  const tooFewMovies = uniqueMovies.size <= 1;
  const showWarning = tooFewExpressions || tooFewMovies;

  const updateRow = (
    id: string,
    field: keyof Omit<ExpressionItem, "id">,
    value: string
  ) => {
    onChange(
      expressions.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const addRow = () => {
    const newId = `exp-${Date.now()}`;
    onChange([
      ...expressions,
      { id: newId, expression: "", koreanMeaning: "", movie: "" },
    ]);
  };

  const removeRow = (id: string) => {
    onChange(expressions.filter((item) => item.id !== id));
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-[#6B6862]">
            Step 1 of 5 · Expression Curating
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#242424] text-balance">
            Movie English Expressions
          </h1>
          <p className="text-sm sm:text-base text-[#524F4A] max-w-2xl">
            Review or customize your movie expressions, Korean meanings, and
            source films. Edits automatically sync into your 4-beat storyboard
            while preserving pacing.
          </p>
        </div>

        <div className="flex items-center gap-3 text-sm text-[#524F4A] shrink-0">
          <span className="font-mono-tabular font-medium">
            {filledExpressions.length} expressions
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular font-medium">
            {uniqueMovies.size} {uniqueMovies.size === 1 ? "movie" : "movies"}
          </span>
        </div>
      </div>

      {showWarning && (
        <div
          role="alert"
          className="rounded-2xl border border-[#F5C518] bg-[#FFFBEB] p-4 flex items-start gap-3 text-[#242424]"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-[#B68600]" />
          <div className="space-y-1 text-sm sm:text-base">
            <p className="font-semibold">Story diversity recommendation</p>
            <p className="text-[#45433E]">
              {tooFewExpressions && tooFewMovies
                ? "You currently have fewer than 5 expressions and only 1 confirmed source movie. Include at least 5 expressions from 2 or more movies for a richer narrative."
                : tooFewExpressions
                ? `You currently have ${filledExpressions.length} expressions. Add at least 5 expressions to anchor all four story beats.`
                : "Your confirmed expressions come from only one source movie. Mix expressions from at least 2 different movies."}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white border border-[#DCD7CE] rounded-2xl overflow-hidden shadow-xs">
        <div className="hidden md:grid md:grid-cols-12 gap-4 px-5 py-3.5 bg-[#F2EEE4] border-b border-[#DCD7CE] text-xs font-semibold text-[#524F4A]">
          <div className="col-span-4">English Expression</div>
          <div className="col-span-4">Korean Meaning (한국어 뜻)</div>
          <div className="col-span-3">Source Movie</div>
          <div className="col-span-1 text-right">Remove</div>
        </div>

        <div className="divide-y divide-[#ECE7DD]">
          {expressions.map((item, idx) => {
            const isUnconfirmed =
              item.movie.trim().toLowerCase() === "to be confirmed";
            return (
              <div
                key={item.id}
                className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center"
              >
                <div className="md:col-span-4 space-y-1">
                  <label className="block md:hidden text-xs font-medium text-[#6B6862]">
                    #{idx + 1} English Expression
                  </label>
                  <input
                    type="text"
                    value={item.expression}
                    onChange={(e) =>
                      updateRow(item.id, "expression", e.target.value)
                    }
                    placeholder="e.g., Hear me out"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D4CFC5] bg-[#FAF7EF] text-base font-medium text-[#242424] focus:outline-none focus:border-[#2449D8] focus:ring-2 focus:ring-[#2449D8]/20"
                  />
                </div>

                <div className="md:col-span-4 space-y-1">
                  <label className="block md:hidden text-xs font-medium text-[#6B6862]">
                    Korean Meaning (한국어 뜻)
                  </label>
                  <input
                    type="text"
                    value={item.koreanMeaning}
                    onChange={(e) =>
                      updateRow(item.id, "koreanMeaning", e.target.value)
                    }
                    placeholder="e.g., 내 이야기를 끝까지 들어봐"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D4CFC5] bg-[#FAF7EF] text-base text-[#242424] focus:outline-none focus:border-[#2449D8] focus:ring-2 focus:ring-[#2449D8]/20"
                  />
                </div>

                <div className="md:col-span-3 space-y-1">
                  <label className="block md:hidden text-xs font-medium text-[#6B6862]">
                    Source Movie
                  </label>
                  <input
                    type="text"
                    value={item.movie}
                    onChange={(e) => updateRow(item.id, "movie", e.target.value)}
                    placeholder="e.g., To be confirmed"
                    className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border text-base focus:outline-none focus:border-[#2449D8] focus:ring-2 focus:ring-[#2449D8]/20 ${
                      isUnconfirmed
                        ? "border-[#E6C86E] bg-[#FFFBEB] text-[#6B5100] italic"
                        : "border-[#D4CFC5] bg-[#FAF7EF] text-[#242424]"
                    }`}
                  />
                </div>

                <div className="md:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeRow(item.id)}
                    aria-label={`Remove ${item.expression || "expression"}`}
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-[#6B6862] hover:text-[#2449D8] hover:bg-[#EEF2FF] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 bg-[#F7F3EA] border-t border-[#ECE7DD] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={addRow}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-[#B8B5AF] bg-white text-sm font-semibold text-[#242424] hover:bg-[#F2EEE4] inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expression</span>
          </button>

          <button
            type="button"
            onClick={onResetDefaults}
            className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium text-[#524F4A] hover:text-[#242424] hover:bg-[#ECE7DD] inline-flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restore 10 Defaults</span>
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          className="w-full sm:w-auto min-h-[50px] px-7 py-3 rounded-xl bg-[#2449D8] text-white text-base font-semibold hover:bg-[#1D3CB8] active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs"
        >
          <span>Continue to 3D Scene & Art Direction</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
}
