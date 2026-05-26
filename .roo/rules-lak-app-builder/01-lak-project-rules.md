---
# Правила разработки приложения "Лакку маз"

## Стек
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- React Router v6
- Zustand (состояние)
- PWA (vite-plugin-pwa)

## Дизайн-система
- Фон: bg-[#F9F6F0]
- Акцент: bg-[#1E3A8A] text-white
- Успех: bg-[#2E7D32]
- Ошибка: bg-[#B91C1C]
- Карточки: bg-white rounded-xl shadow-sm
- Шрифт: Inter (Google Fonts)

## Особенности лакского языка
- Алфавит содержит спецсимволы: Ӏ ӏ, Хъ хъ, Кь кь, Кк кк, Чч чч, Хь хь
- Кастомная клавиатура ОБЯЗАТЕЛЬНА для мобильной версии
- Порядок слов SOV (субъект-объект-глагол)
- Примеры фраз хранятся в src/data/lak.ts

## Структура файлов
- Компоненты: src/components/ИмяКомпонента.tsx
- Страницы: src/pages/ИмяСтраницы.tsx
- Хуки: src/hooks/useИмяХука.ts
- Хранилище: src/store/appStore.ts
- Данные: src/data/lak.ts
- Типы: src/types/index.ts

## Принципы
- Каждый компонент — отдельный файл, export default
- Обрабатывать состояния loading, error, empty
- Все тексты на русском и лакском
- Мобильный-first дизайн
- Перед написанием кода искать примеры в Qdrant RAG через search_documentation