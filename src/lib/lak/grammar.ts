/**
 * Подписи лакской грамматики для карточек и словаря.
 * Класс лакского существительного — не род: I — мужчины, II и III — женщины
 * и предметы (какой — нужно запоминать), IV встречается редко.
 */

const CLASS_LABELS: Record<number, string> = { 1: "I кл. · ур", 2: "II кл. · бур", 3: "III кл. · дур", 4: "IV кл." };

export function lakClassLabel(lakClass: number | null | undefined): string | null {
  return lakClass ? CLASS_LABELS[lakClass] ?? null : null;
}
