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
      .filter(Boolean)
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
          <p className="text-sm font-medium text-[#75726B]">
            Step 1 of 5 · Expression Curating
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#484744] text-balance">
            Movie English Expressions
          </h1>
          <p className="text-sm sm:text-base text-[#66645F] max-w-2xl">
            Curate the English phrases you learned from films, their Korean
            meanings, and source titles to shape your 30-second 3D short film.
          </p>
        </div>

        <div className="flex items-center gap-3 text-sm text-[#66645F] shrink-0">
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
          className="rounded-2xl border border-[#D99A70] bg-[#FAF0E8] p-4 flex items-start gap-3 text-[#6E4427]"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-[#C27849]" />
          <div className="space-y-1 text-sm sm:text-base">
            <p className="font-semibold">Story diversity recommendation</p>
            <p>
              {tooFewExpressions && tooFewMovies
                ? "You currently have fewer than 5 expressions and only 1 source movie. Include at least 5 expressions from 2 or more movies for a richer narrative."
                : tooFewExpressions
                ? `You currently have ${filledExpressions.length} expressions. Add at least 5 expressions to anchor all four story beats.`
                : "All expressions come from a single source movie. Mix expressions from at least 2 different movies."}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white/85 border border-[#D8D2C7] rounded-2xl overflow-hidden shadow-xs">
        <div className="hidden md:grid md:grid-cols-12 gap-4 px-5 py-3.5 bg-[#EAE4D8] border-b border-[#D8D2C7] text-xs font-semibold text-[#5C5A55]">
          <div className="col-span-4">English Expression</div>
          <div className="col-span-4">Korean Meaning (한국어 뜻)</div>
          <div className="col-span-3">Source Movie</div>
          <div className="col-span-1 text-right">Remove</div>
        </div>

        <div className="divide-y divide-[#E6E0D5]">
          {expressions.map((item, idx) => (
            <div
              key={item.id}
              className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center"
            >
              <div className="md:col-span-4 space-y-1">
                <label className="block md:hidden text-xs font-medium text-[#75726B]">
                  #{idx + 1} English Expression
                </label>
                <input
                  type="text"
                  value={item.expression}
                  onChange={(e) =>
                    updateRow(item.id, "expression", e.target.value)
                  }
                  placeholder="e.g., The thing is"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D4CEC2] bg-[#FAF8F4] text-base font-medium text-[#484744] focus:outline-none focus:border-[#D99A70] focus:ring-2 focus:ring-[#D99A70]/25"
                />
              </div>

              <div className="md:col-span-4 space-y-1">
                <label className="block md:hidden text-xs font-medium text-[#75726B]">
                  Korean Meaning (한국어 뜻)
                </label>
                <input
                  type="text"
                  value={item.koreanMeaning}
                  onChange={(e) =>
                    updateRow(item.id, "koreanMeaning", e.target.value)
                  }
                  placeholder="e.g., 실은 말이야"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D4CEC2] bg-[#FAF8F4] text-base text-[#484744] focus:outline-none focus:border-[#D99A70] focus:ring-2 focus:ring-[#D99A70]/25"
                />
              </div>

              <div className="md:col-span-3 space-y-1">
                <label className="block md:hidden text-xs font-medium text-[#75726B]">
                  Source Movie
                </label>
                <input
                  type="text"
                  value={item.movie}
                  onChange={(e) => updateRow(item.id, "movie", e.target.value)}
                  placeholder="e.g., Notting Hill"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D4CEC2] bg-[#FAF8F4] text-base text-[#484744] focus:outline-none focus:border-[#D99A70] focus:ring-2 focus:ring-[#D99A70]/25"
                />
              </div>

              <div className="md:col-span-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeRow(item.id)}
                  aria-label={`Remove ${item.expression || "expression"}`}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-[#7A7770] hover:text-[#B55442] hover:bg-[#F9EAE6] transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-[#F6F2EA] border-t border-[#E6E0D5] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={addRow}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-[#C5C0B8] bg-white text-sm font-semibold text-[#484744] hover:bg-[#EFEAE0] inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expression</span>
          </button>

          <button
            type="button"
            onClick={onResetDefaults}
            className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium text-[#66645F] hover:text-[#484744] hover:bg-[#EAE4D8] inline-flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restore 7 Defaults</span>
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          className="w-full sm:w-auto min-h-[50px] px-7 py-3 rounded-xl bg-[#D99A70] text-white text-base font-semibold hover:bg-[#C6865B] active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs"
        >
          <span>Continue to 3D Scene & Art Direction</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
}
