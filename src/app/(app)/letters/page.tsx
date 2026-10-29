"use client";

import { useEffect, useRef, useState } from "react";
import { LAK_ALPHABET, displayLetter, toLakCanonical, type LakLetter } from "@/lib/lak/alphabet";

// ─── Описания букв (из разговорника Дигиева) ─────────────────────────────────
// Порядок и состав алфавита — из src/lib/lak/alphabet.ts (общий с БД и словарём).
// Ключ — буква в форме ключа: строчная, палочка = ӏ (U+04CF).

type LetterInfo = {
  pronunciation: string | null;
  examples: { lak: string; ru: string }[];
};

const LETTER_INFO: Partial<Record<LakLetter, LetterInfo>> = {
  "а": { pronunciation: null, examples: [{ lak: "арс", ru: "сын" }, { lak: "адрес", ru: "адрес" }] },
  "аь": { pronunciation: "Промежуточный между «А» и «Я», как «я» в слове «мягкий»", examples: [{ lak: "аьрщи", ru: "земля" }, { lak: "аькьлу", ru: "разум" }, { lak: "аьтри", ru: "духи" }] },
  "б": { pronunciation: null, examples: [{ lak: "барчаллагь", ru: "спасибо" }, { lak: "байран", ru: "праздник" }] },
  "в": { pronunciation: null, examples: [{ lak: "вин", ru: "тебе" }] },
  "г": { pronunciation: null, examples: [{ lak: "гьалмахчу", ru: "товарищ" }] },
  "гъ": { pronunciation: "Картавое «Р», как в слове «кукуруза»", examples: [{ lak: "гъуни", ru: "сковорода" }, { lak: "Гъумучи", ru: "Кумух" }, { lak: "гъарив", ru: "бедняк" }] },
  "гь": { pronunciation: "Как немецкое «h» в слове haben (иметь)", examples: [{ lak: "гьан", ru: "идти" }, { lak: "нагь", ru: "масло" }, { lak: "гьулув", ru: "чечевица" }] },
  "д": { pronunciation: null, examples: [{ lak: "дакI", ru: "сердце" }, { lak: "дус", ru: "друг" }, { lak: "даву", ru: "работа" }] },
  "е": { pronunciation: null, examples: [] },
  "ж": { pronunciation: null, examples: [{ lak: "жаваб", ru: "ответ" }, { lak: "жу", ru: "мы" }] },
  "з": { pronunciation: null, examples: [{ lak: "зу", ru: "вы" }] },
  "и": { pronunciation: null, examples: [{ lak: "ина", ru: "ты" }, { lak: "иш", ru: "дело" }] },
  "к": { pronunciation: null, examples: [{ lak: "кулпат", ru: "семья" }] },
  "кк": { pronunciation: "Удвоенное «К» — самостоятельный звук лакского языка", examples: [{ lak: "ккаккан", ru: "показывать" }] },
  "кь": { pronunciation: "Гортанный звук, твёрдая версия Къ", examples: [{ lak: "кьали", ru: "бочка" }, { lak: "халкь", ru: "народ" }, { lak: "кьири", ru: "суша" }] },
  "къ": { pronunciation: "Резкий гортанный «КХ» с резким смыком", examples: [{ lak: "къарпуз", ru: "арбуз" }, { lak: "къатта", ru: "дом" }, { lak: "къама", ru: "зерно" }] },
  "кӏ": { pronunciation: "Абруптивный смычно-гортанный — резкий щелчок", examples: [{ lak: "кIула", ru: "ключ" }] },
  "л": { pronunciation: null, examples: [{ lak: "лас", ru: "муж" }, { lak: "лахьхьин", ru: "учиться" }] },
  "м": { pronunciation: null, examples: [{ lak: "маз", ru: "язык" }, { lak: "мурад", ru: "цель, желание" }] },
  "н": { pronunciation: null, examples: [{ lak: "на", ru: "я" }, { lak: "нину", ru: "мать" }] },
  "о": { pronunciation: null, examples: [] },
  "оь": { pronunciation: "Среднее между «О» и «Е»", examples: [{ lak: "оьл", ru: "корова" }, { lak: "оьсса", ru: "злой" }, { lak: "оьрус", ru: "русский" }] },
  "п": { pronunciation: null, examples: [{ lak: "ппу", ru: "отец" }] },
  "пп": { pronunciation: "Удвоенное «П» — самостоятельный звук", examples: [] },
  "пӏ": { pronunciation: "Абруптивный «П» — резкий щелчок", examples: [{ lak: "пIяй", ru: "блеск" }] },
  "р": { pronunciation: null, examples: [{ lak: "рязи", ru: "согласен" }] },
  "с": { pronunciation: null, examples: [{ lak: "ссу", ru: "сестра" }, { lak: "суал", ru: "вопрос" }] },
  "сс": { pronunciation: "Удвоенное «С» — самостоятельный звук", examples: [{ lak: "уссу", ru: "брат" }] },
  "т": { pronunciation: null, examples: [{ lak: "талихI", ru: "счастье" }] },
  "тт": { pronunciation: "Удвоенное «Т» — самостоятельный звук", examples: [{ lak: "ттучан", ru: "магазин" }, { lak: "ттул", ru: "мой" }] },
  "тӏ": { pronunciation: "Абруптивный «Т» — резкий щелчок", examples: [{ lak: "тIама", ru: "дрова" }] },
  "у": { pronunciation: null, examples: [{ lak: "уссу", ru: "брат" }] },
  "х": { pronunciation: null, examples: [{ lak: "хIакин", ru: "врач" }, { lak: "хъамал", ru: "гости" }] },
  "хх": { pronunciation: "Удвоенное «Х» — самостоятельный звук", examples: [{ lak: "ххуй", ru: "хорошо, красиво" }, { lak: "ххари", ru: "радость" }] },
  "хъ": { pronunciation: "Сочетание «КХ»", examples: [{ lak: "хъа", ru: "крыло" }, { lak: "хъамал", ru: "гости" }] },
  "хь": { pronunciation: "Мягкое «Х», как в слове «хмель»", examples: [{ lak: "хьама", ru: "пена" }, { lak: "хьула", ru: "вилы" }, { lak: "михь", ru: "ноготь" }] },
  "хьхь": { pronunciation: "Удвоенное мягкое «Х»", examples: [{ lak: "хьхьичI", ru: "перед, впереди" }] },
  "хӏ": { pronunciation: "Как «Гь»; ХIа = «Гья», ХIу = «Гью», ХIи = «Гьэ»", examples: [{ lak: "хIарп", ru: "буква" }, { lak: "хIакин", ru: "врач" }, { lak: "хIаллу", ru: "коса" }] },
  "ц": { pronunciation: null, examples: [{ lak: "цу", ru: "он" }] },
  "цц": { pronunciation: "Удвоенное «Ц» — самостоятельный звук", examples: [] },
  "цӏ": { pronunciation: "Абруптивный «Ц» — резкий щелчок", examples: [{ lak: "цIу", ru: "огонь" }, { lak: "цIа", ru: "имя" }] },
  "ч": { pronunciation: null, examples: [{ lak: "чагъар", ru: "письмо" }] },
  "чч": { pronunciation: "Удвоенное «Ч» — самостоятельный звук", examples: [{ lak: "ччаву", ru: "любовь" }, { lak: "ччай", ru: "хотеть" }] },
  "чӏ": { pronunciation: "Абруптивный «Ч» — резкий щелкающий звук", examples: [{ lak: "чIапIи", ru: "лист" }] },
  "ш": { pronunciation: null, examples: [{ lak: "шагьру", ru: "город" }, { lak: "шин", ru: "год" }] },
  "щ": { pronunciation: null, examples: [{ lak: "щар", ru: "жена" }] },
  "ю": { pronunciation: null, examples: [{ lak: "юх", ru: "нет" }] },
  "я": { pronunciation: null, examples: [] },
};

/** Диграфы и буквы с палочкой — звуки, которых нет в русском */
function isSpecial(letter: string): boolean {
  return letter.length > 1;
}

type LetterCount = { letter: string; display: string; count: number };

type DictionaryWord = {
  id: number;
  lemma: string;
  translation: string;
  transcription: string | null;
  partOfSpeech: string | null;
};

const WORDS_LIMIT = 200;

export default function LettersPage() {
  const [selected, setSelected] = useState<LakLetter | null>(null);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [words, setWords] = useState<DictionaryWord[]>([]);
  const [wordsLoading, setWordsLoading] = useState(false);
  const [showSpecialOnly, setShowSpecialOnly] = useState(false);
  const wordListRef = useRef<HTMLDivElement>(null);

  // Счётчики считает сервер по всему словарю (раньше — по первым 1000 словам на клиенте)
  useEffect(() => {
    let mounted = true;
    fetch("/api/letters", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { letters?: LetterCount[] }) => {
        if (mounted) setCounts(new Map((data.letters ?? []).map((l) => [l.letter, l.count])));
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const handleLetterClick = (letter: LakLetter) => {
    if (selected === letter) {
      setSelected(null);
      setWords([]);
      return;
    }
    setSelected(letter);
    setWordsLoading(true);
    const qs = new URLSearchParams({ lakLetter: letter, wordType: "word", primaryOnly: "true", limit: String(WORDS_LIMIT) });
    fetch(`/api/words?${qs}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { words?: DictionaryWord[] }) => setWords(Array.isArray(data.words) ? data.words : []))
      .catch(() => setWords([]))
      .finally(() => setWordsLoading(false));
    setTimeout(() => {
      wordListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const displayedAlphabet = showSpecialOnly ? LAK_ALPHABET.filter(isSpecial) : LAK_ALPHABET;
  const info = selected ? LETTER_INFO[selected] : undefined;
  const selectedCount = selected ? counts.get(selected) ?? 0 : 0;

  return (
    <div className="mx-auto min-h-screen max-w-5xl space-y-6 bg-lk-bg px-4 py-6 font-sans text-lk-text transition-colors duration-[400ms]">

      {/* Заголовок */}
      <section className="lk-card rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-bold text-lk-text">Лакский алфавит</h1>
            <p className="mt-1 text-sm text-lk-muted">
              {LAK_ALPHABET.length} букв · {LAK_ALPHABET.filter(isSpecial).length} специфических лакских
            </p>
          </div>
          <label className="inline-flex cursor-pointer select-none items-center gap-2 rounded-xl border border-lk-gold-border bg-lk-gold-dim px-4 py-2 text-sm font-medium text-lk-gold">
            <input
              type="checkbox"
              checked={showSpecialOnly}
              onChange={(e) => setShowSpecialOnly(e.target.checked)}
              className="accent-[var(--lk-gold)]"
            />
            Только лакские буквы
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-lk-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-lk-gold" />
            Специфический лакский звук
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-lk-navy3" />
            Общий с русским
          </span>
        </div>
      </section>

      {/* Сетка букв */}
      <section className="lk-card rounded-2xl p-6">
        <div className="flex flex-wrap gap-2">
          {displayedAlphabet.map((letter) => {
            const isActive = selected === letter;
            const special = isSpecial(letter);
            const count = counts.get(letter);
            const pronunciation = LETTER_INFO[letter]?.pronunciation;
            return (
              <button
                key={letter}
                type="button"
                onClick={() => handleLetterClick(letter)}
                title={pronunciation ?? displayLetter(letter)}
                aria-pressed={isActive}
                className={[
                  "relative flex min-w-[52px] select-none flex-col items-center justify-center rounded-xl border px-3 py-2.5 text-center transition-all duration-150",
                  isActive
                    ? "border-lk-gold bg-lk-gold text-lk-bg shadow-lk"
                    : special
                    ? "border-lk-gold-border bg-lk-gold-dim text-lk-gold hover:border-lk-gold"
                    : "border-lk-line bg-lk-navy2 text-lk-text hover:border-lk-gold-border",
                ].join(" ")}
              >
                <span className="text-lg font-bold leading-none">{displayLetter(letter)}</span>
                {count ? (
                  <span className={["mt-1 text-[10px] font-medium leading-none", isActive ? "text-lk-bg" : "text-lk-muted"].join(" ")}>
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      {/* Карточка выбранной буквы */}
      {selected && (
        <section className="lk-card rounded-2xl border border-lk-gold-border p-6">
          <div className="flex flex-wrap items-start gap-6">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border-2 border-lk-gold-border bg-lk-navy2 font-serif text-5xl font-bold text-lk-gold">
              {displayLetter(selected)}
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h2 className="text-xl font-bold text-lk-text">
                  «{displayLetter(selected)}» / «{toLakCanonical(selected)}»
                </h2>
                {isSpecial(selected) && (
                  <span className="mt-1 inline-block rounded-full bg-lk-gold-dim px-2.5 py-0.5 text-xs font-semibold text-lk-gold">
                    Специфический лакский звук
                  </span>
                )}
              </div>
              {info?.pronunciation && (
                <div className="rounded-xl border border-lk-line bg-lk-navy2 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-lk-gold">Произношение</p>
                  <p className="mt-1 text-sm text-lk-text">{info.pronunciation}</p>
                </div>
              )}
              {info && info.examples.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-lk-gold">Примеры слов</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {info.examples.map((ex) => (
                      <div key={ex.lak} className="rounded-lg border border-lk-line bg-lk-navy2 px-3 py-1.5 text-sm">
                        <span className="font-semibold text-lk-text">{toLakCanonical(ex.lak)}</span>
                        <span className="text-lk-faint"> — </span>
                        <span className="text-lk-muted">{ex.ru}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Список слов из словаря / Описание алфавита */}
      <section ref={wordListRef}>
        {selected ? (
          <div className="lk-card rounded-2xl p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-lk-text">Слова на «{displayLetter(selected)}»</h2>
              <span className="rounded-full bg-lk-navy2 px-2.5 py-0.5 text-sm font-semibold text-lk-muted">
                {wordsLoading ? "…" : selectedCount > words.length ? `${words.length} из ${selectedCount}` : words.length}
              </span>
            </div>

            {wordsLoading && (
              <div className="mt-4 flex items-center gap-2 text-sm text-lk-muted">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-lk-line border-t-lk-gold" />
                Загружаем слова…
              </div>
            )}

            {!wordsLoading && words.length === 0 && (
              <p className="mt-4 rounded-xl border border-lk-line bg-lk-navy2 p-4 text-sm text-lk-muted">
                В словаре нет слов на букву «{displayLetter(selected)}».
              </p>
            )}

            {!wordsLoading && words.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-lk-line text-xs uppercase tracking-wide text-lk-muted">
                      <th className="pb-2 pr-4 font-medium">Слово</th>
                      <th className="pb-2 pr-4 font-medium">Перевод</th>
                      <th className="pb-2 font-medium">Часть речи</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-lk-line">
                    {words.map((word) => (
                      <tr key={word.id} className="transition-colors hover:bg-lk-navy2">
                        <td className="py-2.5 pr-4 font-semibold text-lk-text">{word.lemma}</td>
                        <td className="py-2.5 pr-4 text-lk-muted">{word.translation}</td>
                        <td className="py-2.5">
                          {word.partOfSpeech ? (
                            <span className="rounded-full bg-lk-navy2 px-2 py-0.5 text-xs text-lk-muted">
                              {word.partOfSpeech}
                            </span>
                          ) : (
                            <span className="text-lk-faint">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <section className="lk-card rounded-2xl p-6">
            <h2 className="text-base font-bold text-lk-text">Особенности лакского алфавита</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {[
                {
                  title: "Абруптивные согласные",
                  text: "КӀ, ПӀ, ТӀ, ЦӀ, ЧӀ — буква + палочка Ӏ. Резкий щелкающий звук: язык плотнее прижимается, воздух прорывается с усилием.",
                  letters: ["КӀ", "ПӀ", "ТӀ", "ЦӀ", "ЧӀ"],
                },
                {
                  title: "Гортанные согласные",
                  text: "Гъ, Гь, Хъ, Хь, ХӀ, Къ, Кь — кавказские звуки, образующиеся в гортани. Требуют практики на слух.",
                  letters: ["Гъ", "Гь", "Хъ", "Хь", "ХӀ", "Къ", "Кь"],
                },
                {
                  title: "Гласные с умляутом",
                  text: "Аь — между «А» и «Я». Оь — между «О» и «Е». Оба звука смягчают произношение.",
                  letters: ["Аь", "Оь"],
                },
                {
                  title: "Удвоенные буквы",
                  text: "Кк, Пп, Сс, Тт, Хх, Цц, Чч, Хьхь — не просто двойное написание, а отдельные звуки и отдельные буквы алфавита.",
                  letters: ["Кк", "Пп", "Сс", "Тт", "Хх", "Цц", "Чч", "Хьхь"],
                },
              ].map((group) => (
                <div key={group.title} className="rounded-xl border border-lk-line bg-lk-navy2 p-4">
                  <h3 className="text-sm font-semibold text-lk-gold">{group.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-lk-muted">{group.text}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {group.letters.map((c) => (
                      <span key={c} className="rounded-lg border border-lk-gold-border bg-lk-gold-dim px-2 py-1 text-sm font-bold text-lk-gold">{c}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-lk-line bg-lk-navy2 p-4">
              <p className="text-sm leading-relaxed text-lk-muted">
                <span className="font-semibold text-lk-text">Совет:</span> нажмите на букву, чтобы увидеть произношение и слова из словаря, начинающиеся с неё.
              </p>
            </div>
          </section>
        )}
      </section>
    </div>
  );
}
