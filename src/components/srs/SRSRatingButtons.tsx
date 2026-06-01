import type { SRSRating } from "@/types/srs";

interface SRSRatingButtonsProps {
  onRate: (rating: SRSRating) => void;
  disabled?: boolean;
  isInputLocked?: boolean;
}

const BUTTONS = [
  {
    key: "forgot" as SRSRating,
    label: "Забыл",
    hint: "1",
    icon: "✕",
    style: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200",
    iconStyle: "text-red-400",
  },
  {
    key: "unsure" as SRSRating,
    label: "Не уверен",
    hint: "2",
    icon: "~",
    style: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 active:bg-amber-200",
    iconStyle: "text-amber-400",
  },
  {
    key: "know" as SRSRating,
    label: "Знаю",
    hint: "3",
    icon: "✓",
    style: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:bg-emerald-200",
    iconStyle: "text-emerald-500",
  },
] as const;

export function SRSRatingButtons({
  onRate,
  disabled = false,
  isInputLocked = false,
}: SRSRatingButtonsProps) {
  const isBlocked = disabled || isInputLocked;

  return (
    <div className="w-full max-w-[460px] space-y-3">

      {/* Кнопки оценки */}
      <div className="flex gap-3">
        {BUTTONS.map((btn) => (
          <button
            key={btn.key}
            type="button"
            onClick={() => onRate(btn.key)}
            disabled={isBlocked}
            className={[
              "group flex flex-1 flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-4 transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              "disabled:pointer-events-none disabled:opacity-40",
              "active:scale-[0.97]",
              isBlocked ? "" : btn.style,
              !isBlocked ? "cursor-pointer" : "cursor-not-allowed",
            ].join(" ")}
          >
            {/* Иконка */}
            <span className={[
              "text-xl font-bold leading-none transition-transform duration-150 group-active:scale-90",
              btn.iconStyle,
            ].join(" ")}>
              {btn.icon}
            </span>

            {/* Название */}
            <span className="text-sm font-semibold leading-none">
              {btn.label}
            </span>

            {/* Клавиша */}
            <span className="rounded-md bg-white/60 px-1.5 py-0.5 font-mono text-[10px] font-medium opacity-60">
              {btn.hint}
            </span>
          </button>
        ))}
      </div>

      {/* Подсказка состояния */}
      <p className="text-center text-xs text-gray-400">
        {isInputLocked
          ? "Сохраняем..."
          : disabled
          ? "Space / Enter — открыть перевод"
          : "Оцените насколько хорошо вы знаете слово"}
      </p>
    </div>
  );
}