/**
 * Русское множественное число: plural(21, ["день", "дня", "дней"]) → «день».
 * 1, 21, 31… — первая форма; 2–4, 22–24… — вторая; 0, 5–20, 25–30… — третья.
 */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

/** «21 день», «3 фразы», «0 карточек» */
export function countLabel(n: number, forms: [string, string, string]): string {
  return `${n} ${plural(n, forms)}`;
}
