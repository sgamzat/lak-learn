ТЕХНИЧЕСКОЕ ЗАДАНИЕ: Фронтенд Dashboard + SRS-экран

Цель: Реализовать клиентскую часть личного кабинета пользователя и экрана интервального повторения для веб-приложения изучения лакского языка. Аудио-функционал исключён полностью. Фокус на чтение, перевод, визуальную навигацию и текстовый SRS.
📦 1. Общие технические требования


Параметр
Требование
Фреймворк
Next.js 14+ (App Router), React 18+, TypeScript
Стили
Tailwind CSS, clsx/tailwind-merge для условных классов
Анимации
Framer Motion или CSS @keyframes (предпочтительно CSS для производительности)
Иконки
lucide-react или аналог
Стейт
Zustand или React Context + useReducer (для SRS-очереди и UI-состояний)
Аудио
Полностью отсутствует. Никаких <audio>, Howler или Web Audio API.
Моки
Все данные на первом этапе берутся из локальных JSON/TS-файлов. API-заглушки через fetch с setTimeout.
🏠 2. Компонент: Dashboard

2.1. Структура макета (сетка)

Контейнер: max-w-7xl mx-auto px-4 py-6
Хедер: Flex-row, h-16, justify-between, items-center. Слева: приветствие text-2xl font-bold. Справа: бейджи 🔥 7 дней и ⭐ 340 XP (flex-row, gap-3).
Основная зона: CSS Grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3, gap-6.
Ячейка 1: CTA «Продолжить урок» (выделяется цветом, col-span-1 lg:col-span-2)
Ячейка 2: SRS-виджет «Слова на повторение»
Ячейка 3: Прогресс-метрики (вертикальный стек)
Ячейка 4: Быстрые ссылки (горизонтальный скролл на мобильных, grid на десктопе)
2.2. Элементы и размеры


Элемент
Размеры / Стили
CTA-карточка
w-full min-h-[160px] rounded-2xl p-6 bg-gradient-to-br from-blue-600 to-blue-700 text-white hover:scale-[1.02] transition
SRS-виджет
w-full h-[160px] rounded-2xl p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
Прогресс-бар
h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden + заполнитель h-full bg-green-500 transition-all duration-1000 ease-out
Метрика-круг
w-28 h-28 (SVG circle с stroke-dasharray/dashoffset)
2.3. Состояния (States)


Состояние
Поведение UI
loading
Скелетоны: 6 прямоугольников animate-pulse, bg-gray-200, rounded-xl, h-16/h-40
srsQueueEmpty
SRS-виджет меняет фон на серый, текст: «Нет слов для повторения», кнопка: «Начать новый урок»
srsQueueAvailable
Виджет показывает 🔴 12 слов просрочено, 🟡 5 скоро, кнопка «Начать повторение» активна (primary)
hover
Все карточки получают shadow-lg, translate-y-[-2px], курсор pointer
click/active
scale-[0.98] на 150мс
2.4. Микро-анимации

Загрузка данных: opacity 0→1, translate-y 12px→0 с staggerChildren: 0.05s
Прогресс-бар: заполнение с duration-700 ease-out при монтировании
Кнопки: transition-all duration-200, при наведении тень shadow-md, при клике легкое сжатие
🔄 3. Компонент: SRSReviewScreen

3.1. Структура макета

Обёртка: fixed inset-0 bg-gray-50 dark:bg-gray-900 z-50 flex flex-col
Верхняя панель: h-12 px-4 flex justify-between items-center bg-white dark:bg-gray-800 shadow-sm. Слева: Кнопка ← Назад, Справа: Прогресс: 3/15
Центр: Flex-center, flex-1 p-4
Карточка: w-full max-w-[420px] aspect-[4/3] rounded-3xl bg-white dark:bg-gray-800 shadow-xl p-8 flex flex-col items-center justify-center text-center
Нижняя панель: px-4 pb-6 pt-2 flex justify-center gap-3
3.2. Содержимое карточки


Блок
Стили / Размеры
Лакское слово
text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2
Транскрипция/Чтение
text-lg text-gray-500 dark:text-gray-400 font-mono mb-4
Часть речи
px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-medium mb-6
Перевод (скрыт)
opacity-0 absolute → при клике opacity-1 relative, text-xl text-gray-800 dark:text-gray-100
Пример предложения (скрыт)
Появляется под переводом, text-base italic text-gray-600 dark:text-gray-300 mt-2
3.3. Кнопки оценки

Контейнер: flex w-full max-w-md justify-between gap-2
Кнопки (3 шт):
Забыл (красный): bg-red-500 hover:bg-red-600
Не уверен (жёлтый): bg-yellow-500 hover:bg-yellow-600
Знаю (зелёный): bg-green-500 hover:bg-green-600
Размеры: h-14 px-4 rounded-xl text-white font-semibold text-sm flex-1 transition hover:scale-[1.03] active:scale-[0.97]
Подсказка: text-xs text-gray-500 text-center mt-2 (например: ← 1 | 2 | 3 →)
3.4. Логика и состояния


Событие
Реакция фронтенда
mount
Загрузка карточки из локальной очереди. Анимация fadeIn + slideUp
click card
Toggle показа перевода и примера. Плавный opacity/translate переход (300мс)
rate button
Карточка анимирует уход (exit: x ±100% или y -100%). Очередь сдвигается. Следующая карточка входит
keyboard
Space/Enter → показать ответ. 1 → Забыл, 2 → Не уверен, 3 → Знаю
queueEmpty
Замена экрана на SummaryScreen: Вы повторили 15 слов. Точность: 87%. Кнопка «Вернуться на главную»
3.5. Микро-анимации

Появление карточки: from opacity-0 scale-95 to opacity-100 scale-100 duration-300
Переворот/показ ответа: height expand, fade-in контента, легкий shadow усиление
Уход по оценке: slideOut в зависимости от кнопки (влево/вправо/вверх)
Кнопки: press эффект scale(0.95), ring-2 ring-offset-2 при фокусе
📱 4. Адаптивность и доступность (a11y)


Требование
Реализация
Mobile-first
На <768px: сетка в 1 колонку, навигация → bottom-tab (если предусмотрено), карточка w-full, кнопки h-16
Touch targets
Минимальный размер интерактивных элементов 44×44px
Keyboard nav
Tab проходит по всем элементам, Enter/Space активирует, Escape закрывает SRS-экран
ARIA
role="button", aria-label="Показать перевод", aria-live="polite" для смены карточки, aria-pressed для состояний кнопок
Контраст
Текст #111827 на #FFFFFF (коэффициент ≥ 7:1). Кнопки проходят WCAG AA.
Уменьшение анимаций
@media (prefers-reduced-motion: reduce) → отключить scale, slide, оставить opacity или убрать полностью
🛠️ 5. Инструкция для ИИ-реализации

Создать структуру файлов:


1234567
src/app/(app)/dashboard/page.tsxsrc/app/(app)/review/page.tsxsrc/components/dashboard/DashboardShell.tsxsrc/components/dashboard/SRSQueueWidget.tsxsrc/components/srs/SRSReviewScreen.tsxsrc/components/srs/Flashcard.tsxsrc/lib/srs-queue.mock.ts
Сгенерировать компоненты строго по ТЗ: использовать Tailwind-классы, избегать inline-стилей. Анимации реализовать через CSS или framer-motion (если указано).
Подключить моки: создать массив из 15–20 карточек с полями id, word, transcription, pos, translation, example, intervalState.
Реализовать локальный стейт: очередь в useState или useReducer. При нажатии кнопки оценки удалять карточку из массива, обновлять currentIndex, сохранять results в отдельный массив.
Проверить состояния: loading, empty, hasData, keyboard-only, mobile layout, prefers-reduced-motion.
Не подключать бэкенд: использовать fetch-заглушки с Promise.resolve() и задержкой 300ms.
Добавить комментарии: в коде отметить места, где позже будет подключение к API (// TODO: replace mock with /api/srs/queue).
📘 6. Готовые TypeScript-интерфейсы

ts


12345678910111213141516171819202122232425262728293031323334353637383940
// src/types/dashboard.tsexport interface UserProfile {  name: string;  streak: number;  xp: number;}export interface ProgressMetrics {  lessonsCompleted: number;  accuracy: number; // 0-100  currentLevel: string; // "A1", "A2", etc.}export interface SRSQueueSummary {  overdue: number;  dueSoon: number;  nextReviewTime: string | null; // ISO или "Нет доступных"}// src/types/srs.tsexport type SRSRating = "forgot" | "unsure" | "know";export interface FlashcardData {  id: string;  word: string;  transcription: string;  partOfSpeech: string;  translation: string;  exampleSentence: string;  difficulty: 1 | 2 | 3 | 4 | 5;  nextReviewDate: string; // ISO}export interface SRSReviewState {  queue: FlashcardData[];  currentIndex: number;  isRevealed: boolean;  results: { cardId: string; rating: SRSRating; timestamp: number }[];  isFinished: boolean;}
