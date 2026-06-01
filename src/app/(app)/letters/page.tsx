"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ─── Данные алфавита (из разговорника Дигиева) ────────────────────────────────

type Letter = {
  char: string;
  lower: string;
  isSpecial: boolean;
  pronunciation: string | null;
  examples: { lak: string; ru: string }[];
};

const LAK_ALPHABET: Letter[] = [
  { char: "А", lower: "а", isSpecial: false, pronunciation: null, examples: [{ lak: "арс", ru: "сын" }, { lak: "адрес", ru: "адрес" }] },
  { char: "Аь", lower: "аь", isSpecial: true, pronunciation: "Промежуточный между «А» и «Я», как «я» в слове «мягкий»", examples: [{ lak: "аьрщи", ru: "земля" }, { lak: "аькьлу", ru: "разум" }, { lak: "аьтри", ru: "духи" }] },
  { char: "Б", lower: "б", isSpecial: false, pronunciation: null, examples: [{ lak: "барчаллагь", ru: "спасибо" }, { lak: "байран", ru: "праздник" }] },
  { char: "В", lower: "в", isSpecial: false, pronunciation: null, examples: [{ lak: "вин", ru: "тебе" }] },
  { char: "Г", lower: "г", isSpecial: false, pronunciation: null, examples: [{ lak: "гьалмахчу", ru: "товарищ" }] },
  { char: "Гъ", lower: "гъ", isSpecial: true, pronunciation: "Картавое «Р», как в слове «кукуруза»", examples: [{ lak: "гъуни", ru: "сковорода" }, { lak: "Гъумучи", ru: "Кумух" }, { lak: "гъарив", ru: "бедняк" }] },
  { char: "Гь", lower: "гь", isSpecial: true, pronunciation: "Как немецкое «h» в слове haben (иметь)", examples: [{ lak: "гьан", ru: "идти" }, { lak: "нагь", ru: "масло" }, { lak: "гьулув", ru: "чечевица" }] },
  { char: "Д", lower: "д", isSpecial: false, pronunciation: null, examples: [{ lak: "дакI", ru: "сердце" }, { lak: "дус", ru: "друг" }, { lak: "даву", ru: "работа" }] },
  { char: "Е", lower: "е", isSpecial: false, pronunciation: null, examples: [] },
  { char: "Ж", lower: "ж", isSpecial: false, pronunciation: null, examples: [{ lak: "жаваб", ru: "ответ" }, { lak: "жу", ru: "мы" }] },
  { char: "З", lower: "з", isSpecial: false, pronunciation: null, examples: [{ lak: "зу", ru: "вы" }] },
  { char: "И", lower: "и", isSpecial: false, pronunciation: null, examples: [{ lak: "ина", ru: "ты" }, { lak: "иш", ru: "дело" }] },
  { char: "К", lower: "к", isSpecial: false, pronunciation: null, examples: [{ lak: "кулпат", ru: "семья" }] },
  { char: "Кк", lower: "кк", isSpecial: true, pronunciation: "Удвоенное «К» — самостоятельный звук лакского языка", examples: [{ lak: "ккаккан", ru: "показывать" }] },
  { char: "Кь", lower: "кь", isSpecial: true, pronunciation: "Гортанный звук, твёрдая версия Къ", examples: [{ lak: "кьали", ru: "бочка" }, { lak: "халкь", ru: "народ" }, { lak: "кьири", ru: "суша" }] },
  { char: "Къ", lower: "къ", isSpecial: true, pronunciation: "Резкий гортанный «КХ» с резким смыком", examples: [{ lak: "къарпуз", ru: "арбуз" }, { lak: "къатта", ru: "дом" }, { lak: "къама", ru: "зерно" }] },
  { char: "КI", lower: "кI", isSpecial: true, pronunciation: "Абруптивный смычно-гортанный — резкий щелчок", examples: [{ lak: "кIула", ru: "ключ" }] },
  { char: "Л", lower: "л", isSpecial: false, pronunciation: null, examples: [{ lak: "лас", ru: "муж" }, { lak: "лахьхьин", ru: "учиться" }] },
  { char: "М", lower: "м", isSpecial: false, pronunciation: null, examples: [{ lak: "маз", ru: "язык" }, { lak: "мурад", ru: "цель, желание" }] },
  { char: "Н", lower: "н", isSpecial: false, pronunciation: null, examples: [{ lak: "на", ru: "я" }, { lak: "нину", ru: "мать" }] },
  { char: "О", lower: "о", isSpecial: false, pronunciation: null, examples: [] },
  { char: "Оь", lower: "оь", isSpecial: true, pronunciation: "Среднее между «О» и «Е»", examples: [{ lak: "оьл", ru: "корова" }, { lak: "оьсса", ru: "злой" }, { lak: "оьрус", ru: "русский" }] },
  { char: "П", lower: "п", isSpecial: false, pronunciation: null, examples: [{ lak: "ппу", ru: "отец" }] },
  { char: "Пп", lower: "пп", isSpecial: true, pronunciation: "Удвоенное «П» — самостоятельный звук", examples: [] },
  { char: "ПI", lower: "пI", isSpecial: true, pronunciation: "Абруптивный «П» — резкий щелчок", examples: [{ lak: "пIяй", ru: "блеск" }] },
  { char: "Р", lower: "р", isSpecial: false, pronunciation: null, examples: [{ lak: "рязи", ru: "согласен" }] },
  { char: "С", lower: "с", isSpecial: false, pronunciation: null, examples: [{ lak: "ссу", ru: "сестра" }, { lak: "суал", ru: "вопрос" }] },
  { char: "Сс", lower: "сс", isSpecial: true, pronunciation: "Удвоенное «С» — самостоятельный звук", examples: [{ lak: "уссу", ru: "брат" }] },
  { char: "Т", lower: "т", isSpecial: false, pronunciation: null, examples: [{ lak: "талихI", ru: "счастье" }] },
  { char: "Тт", lower: "тт", isSpecial: true, pronunciation: "Удвоенное «Т» — самостоятельный звук", examples: [{ lak: "ттучан", ru: "магазин" }, { lak: "ттул", ru: "мой" }] },
  { char: "ТI", lower: "тI", isSpecial: true, pronunciation: "Абруптивный «Т» — резкий щелчок", examples: [{ lak: "тIама", ru: "дрова" }] },
  { char: "У", lower: "у", isSpecial: false, pronunciation: null, examples: [{ lak: "уссу", ru: "брат" }] },
  { char: "Х", lower: "х", isSpecial: false, pronunciation: null, examples: [{ lak: "хIакин", ru: "врач" }, { lak: "хъамал", ru: "гости" }] },
  { char: "Хх", lower: "хх", isSpecial: true, pronunciation: "Удвоенное «Х» — самостоятельный звук", examples: [{ lak: "ххуй", ru: "хорошо, красиво" }, { lak: "ххари", ru: "радость" }] },
  { char: "Хъ", lower: "хъ", isSpecial: true, pronunciation: "Сочетание «КХ»", examples: [{ lak: "хъа", ru: "крыло" }, { lak: "хъамал", ru: "гости" }] },
  { char: "Хь", lower: "хь", isSpecial: true, pronunciation: "Мягкое «Х», как в слове «хмель»", examples: [{ lak: "хьама", ru: "пена" }, { lak: "хьула", ru: "вилы" }, { lak: "михь", ru: "ноготь" }] },
  { char: "Хьхь", lower: "хьхь", isSpecial: true, pronunciation: "Удвоенное мягкое «Х»", examples: [{ lak: "хьхьичI", ru: "перед, впереди" }] },
  { char: "ХI", lower: "хI", isSpecial: true, pronunciation: "Как «Гь»; ХIа = «Гья», ХIу = «Гью», ХIи = «Гьэ»", examples: [{ lak: "хIарп", ru: "буква" }, { lak: "хIакин", ru: "врач" }, { lak: "хIаллу", ru: "коса" }] },
  { char: "Ц", lower: "ц", isSpecial: false, pronunciation: null, examples: [{ lak: "цу", ru: "он" }] },
  { char: "Цц", lower: "цц", isSpecial: true, pronunciation: "Удвоенное «Ц» — самостоятельный звук", examples: [] },
  { char: "ЦI", lower: "цI", isSpecial: true, pronunciation: "Абруптивный «Ц» — резкий щелчок", examples: [{ lak: "цIу", ru: "огонь" }, { lak: "цIа", ru: "имя" }] },
  { char: "Ч", lower: "ч", isSpecial: false, pronunciation: null, examples: [{ lak: "чагъар", ru: "письмо" }] },
  { char: "Чч", lower: "чч", isSpecial: true, pronunciation: "Удвоенное «Ч» — самостоятельный звук", examples: [{ lak: "ччаву", ru: "любовь" }, { lak: "ччай", ru: "хотеть" }] },
  { char: "ЧI", lower: "чI", isSpecial: true, pronunciation: "Абруптивный «Ч» — резкий щелкающий звук", examples: [{ lak: "чIапIи", ru: "лист" }] },
  { char: "Ш", lower: "ш", isSpecial: false, pronunciation: null, examples: [{ lak: "шагьру", ru: "город" }, { lak: "шин", ru: "год" }] },
  { char: "Щ", lower: "щ", isSpecial: false, pronunciation: null, examples: [{ lak: "щар", ru: "жена" }] },
  { char: "Ю", lower: "ю", isSpecial: false, pronunciation: null, examples: [{ lak: "юх", ru: "нет" }] },
  { char: "Я", lower: "я", isSpecial: false, pronunciation: null, examples: [] },
];

type DictionaryWord = {
  id: number;
  lemma: string;
  translation: string;
  transcription: string | null;
  partOfSpeech: string | null;
};

export default function LettersPage() {
  const [selectedLetter, setSelectedLetter] = useState<Letter | null>(null);
  const [allWords, setAllWords] = useState<DictionaryWord[]>([]);
  const [wordsLoading, setWordsLoading] = useState(false);
  const [showSpecialOnly, setShowSpecialOnly] = useState(false);
  const wordListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWordsLoading(true);
    fetch("/api/words?limit=1000")
      .then((r) => r.json())
      .then((data) => setAllWords(Array.isArray(data.words) ? data.words : []))
      .catch(() => setAllWords([]))
      .finally(() => setWordsLoading(false));
  }, []);

  const filteredWords = useMemo(() => {
    if (!selectedLetter) return [];
    const chars = [selectedLetter.char, selectedLetter.lower].map((c) => c.toLowerCase());
    return allWords.filter((w) =>
      chars.some((c) => w.lemma.toLowerCase().startsWith(c))
    );
  }, [selectedLetter, allWords]);

  const displayedAlphabet = showSpecialOnly
    ? LAK_ALPHABET.filter((l) => l.isSpecial)
    : LAK_ALPHABET;

  const handleLetterClick = (letter: Letter) => {
    setSelectedLetter((prev) => (prev?.char === letter.char ? null : letter));
    setTimeout(() => {
      wordListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  // Считаем слова для буквы (для отображения счётчика)
  const getWordCount = (letter: Letter) => {
    const chars = [letter.char, letter.lower].map((c) => c.toLowerCase());
    return allWords.filter((w) =>
      chars.some((c) => w.lemma.toLowerCase().startsWith(c))
    ).length;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">

      {/* Заголовок */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Лакский алфавит</h1>
            <p className="mt-1 text-sm text-gray-500">
              {LAK_ALPHABET.length} букв · {LAK_ALPHABET.filter((l) => l.isSpecial).length} специфических лакских символов
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 select-none">
            <input
              type="checkbox"
              checked={showSpecialOnly}
              onChange={(e) => setShowSpecialOnly(e.target.checked)}
              className="accent-amber-500"
            />
            Только лакские символы
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
            Специфический лакский звук
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-200" />
            Общий с русским
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
            Выбранная буква
          </span>
        </div>
      </section>

      {/* Сетка букв */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap gap-2">
          {displayedAlphabet.map((letter) => {
            const isActive = selectedLetter?.char === letter.char;
            const count = getWordCount(letter);
            return (
              <button
                key={letter.char}
                type="button"
                onClick={() => handleLetterClick(letter)}
                title={letter.pronunciation ?? letter.char}
                className={[
                  "relative flex min-w-[52px] flex-col items-center justify-center rounded-xl border px-3 py-2.5 text-center transition-all duration-150 select-none",
                  isActive
                    ? "border-blue-500 bg-blue-50 text-blue-700 shadow-md ring-2 ring-blue-200"
                    : letter.isSpecial
                    ? "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:shadow-sm"
                    : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 hover:shadow-sm",
                ].join(" ")}
              >
                <span className="text-lg font-bold leading-none">{letter.char}</span>
                {count > 0 && (
                  <span className={["mt-1 text-[10px] font-medium leading-none", isActive ? "text-blue-500" : "text-gray-400"].join(" ")}>
                    {count}
                  </span>
                )}
                {letter.isSpecial && !isActive && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-400 ring-1 ring-white" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Карточка выбранной буквы */}
      {selectedLetter && (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
          <div className="flex flex-wrap items-start gap-6">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border-2 border-blue-300 bg-white text-5xl font-bold text-blue-700 shadow-sm">
              {selectedLetter.char}
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h2 className="text-xl font-bold text-blue-900">
                  «{selectedLetter.char}» / «{selectedLetter.lower}»
                </h2>
                {selectedLetter.isSpecial && (
                  <span className="mt-1 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    Специфический лакский звук
                  </span>
                )}
              </div>
              {selectedLetter.pronunciation && (
                <div className="rounded-xl border border-blue-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Произношение</p>
                  <p className="mt-1 text-sm text-gray-700">{selectedLetter.pronunciation}</p>
                </div>
              )}
              {selectedLetter.examples.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Примеры слов</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedLetter.examples.map((ex) => (
                      <div key={ex.lak} className="rounded-lg border border-blue-100 bg-white px-3 py-1.5 text-sm">
                        <span className="font-semibold text-gray-900">{ex.lak}</span>
                        <span className="text-gray-400"> — </span>
                        <span className="text-gray-600">{ex.ru}</span>
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
        {selectedLetter ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-gray-900">
                Слова на «{selectedLetter.char}»
              </h2>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-semibold text-gray-600">
                {wordsLoading ? "..." : filteredWords.length}
              </span>
            </div>

            {wordsLoading && (
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
                Загружаем слова...
              </div>
            )}

            {!wordsLoading && filteredWords.length === 0 && (
              <p className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-500">
                В словаре пока нет слов на букву «{selectedLetter.char}». После импорта данных они появятся здесь.
              </p>
            )}

            {!wordsLoading && filteredWords.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                      <th className="pb-2 pr-4 font-medium">Слово</th>
                      <th className="pb-2 pr-4 font-medium">Перевод</th>
                      <th className="pb-2 pr-4 font-medium">Транскрипция</th>
                      <th className="pb-2 font-medium">Часть речи</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredWords.map((word) => (
                      <tr key={word.id} className="transition-colors hover:bg-gray-50">
                        <td className="py-2.5 pr-4 font-semibold text-gray-900">{word.lemma}</td>
                        <td className="py-2.5 pr-4 text-gray-600">{word.translation}</td>
                        <td className="py-2.5 pr-4 font-mono text-xs text-gray-400">{word.transcription ?? "—"}</td>
                        <td className="py-2.5">
                          {word.partOfSpeech ? (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                              {word.partOfSpeech}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
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
          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-base font-bold text-gray-900">Особенности лакского алфавита</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                <h3 className="text-sm font-semibold text-amber-800">Абруптивные согласные</h3>
                <p className="mt-1 text-xs leading-relaxed text-amber-700">
                  КI, ПI, ТI, ЦI, ЧI — буква + «палочка I». Резкий щелкающий звук: язык плотнее прижимается, воздух прорывается с усилием.
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {["КI", "ПI", "ТI", "ЦI", "ЧI"].map((c) => (
                    <span key={c} className="rounded-lg border border-amber-200 bg-white px-2 py-1 text-sm font-bold text-amber-900">{c}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-purple-100 bg-purple-50 p-4">
                <h3 className="text-sm font-semibold text-purple-800">Гортанные согласные</h3>
                <p className="mt-1 text-xs leading-relaxed text-purple-700">
                  Гъ, Гь, Хъ, Хь, ХI, Кь, Къ — уникальные кавказские звуки, образующиеся в гортани. Требуют практики на слух.
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {["Гъ", "Гь", "Хъ", "Хь", "ХI", "Кь", "Къ"].map((c) => (
                    <span key={c} className="rounded-lg border border-purple-200 bg-white px-2 py-1 text-sm font-bold text-purple-900">{c}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-green-100 bg-green-50 p-4">
                <h3 className="text-sm font-semibold text-green-800">Гласные с умляутом</h3>
                <p className="mt-1 text-xs leading-relaxed text-green-700">
                  Аь — между «А» и «Я». Оь — между «О» и «Е». Оба звука смягчают произношение.
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {["Аь", "Оь"].map((c) => (
                    <span key={c} className="rounded-lg border border-green-200 bg-white px-2 py-1 text-sm font-bold text-green-900">{c}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <h3 className="text-sm font-semibold text-blue-800">Удвоенные буквы</h3>
                <p className="mt-1 text-xs leading-relaxed text-blue-700">
                  Кк, Пп, Сс, Тт, Хх, Цц, Чч — не просто двойное написание, а отдельные самостоятельные звуки.
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {["Кк", "Пп", "Сс", "Тт", "Хх", "Цц", "Чч"].map((c) => (
                    <span key={c} className="rounded-lg border border-blue-200 bg-white px-2 py-1 text-sm font-bold text-blue-900">{c}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm leading-relaxed text-gray-600">
                <span className="font-semibold text-gray-800">Совет:</span> нажмите на любую букву выше, чтобы увидеть описание произношения и список слов из словаря, начинающихся с этой буквы.
              </p>
            </div>
          </section>
        )}
      </section>
    </div>
  );
}