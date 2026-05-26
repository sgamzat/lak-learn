import type { SRSRating } from "@/types/srs";

interface SRSRatingButtonsProps {
  onRate: (rating: SRSRating) => void;
  disabled?: boolean;
  isInputLocked?: boolean;
}

const buttons: Array<{ key: SRSRating; label: string; className: string }> = [
  { key: "forgot", label: "Забыл", className: "bg-red-500 hover:bg-red-600" },
  { key: "unsure", label: "Не уверен", className: "bg-yellow-500 hover:bg-yellow-600" },
  { key: "know", label: "Знаю", className: "bg-green-500 hover:bg-green-600" }
];

export function SRSRatingButtons({ onRate, disabled = false, isInputLocked = false }: SRSRatingButtonsProps) {
  const isBlocked = disabled || isInputLocked;

  return (
    <div className="w-full max-w-md">
      <div className="flex w-full justify-between gap-2">
        {buttons.map((button) => (
          <button
            key={button.key}
            type="button"
            onClick={() => onRate(button.key)}
            disabled={isBlocked}
            className={`${button.className} min-h-11 h-16 flex-1 rounded-xl px-4 text-sm font-semibold text-white transition hover:scale-[1.03] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:active:scale-100 md:h-14`}
          >
            {button.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-gray-500">
        {isInputLocked
          ? "Переход к следующей карточке..."
          : disabled
            ? "Сначала откройте перевод (Space/Enter), затем 1 | 2 | 3"
            : "← 1 | 2 | 3 →"}
      </p>
    </div>
  );
}
