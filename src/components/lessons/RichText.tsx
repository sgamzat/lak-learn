import { Fragment, type ReactNode } from "react";

/**
 * Простая разметка текстов урока: **жирный** (лакские слова и формы),
 * пустая строка — новый абзац, перевод строки — новая строка.
 */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-serif font-semibold text-lk-gold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

export function RichText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`space-y-3 text-[15px] leading-relaxed text-lk-text ${className}`}>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i}>
          {para.split("\n").map((line, j, all) => (
            <Fragment key={j}>
              {inline(line)}
              {j < all.length - 1 ? <br /> : null}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
