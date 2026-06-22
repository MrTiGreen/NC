# Telegram Mini Chat

Минималистичный MVP чата для Telegram Mini App: авторизация через Telegram `initData`, общий чат, приватные сообщения, PostgreSQL, Prisma, Express, Socket.IO и React/Vite.

## Стек

- Frontend: React, TypeScript, Vite, CSS Modules, Telegram WebApp SDK.
- Backend: Express, TypeScript, Prisma, Socket.IO.
- Database: PostgreSQL.
- Monorepo: npm workspaces.

## Быстрый запуск

1. Установите зависимости:

```bash
npm install
```

2. Создайте `.env`:

```bash
cp .env.example .env
```

3. Запустите PostgreSQL:

```bash
docker compose up -d db
```

4. Примените миграции и сгенерируйте Prisma Client:

```bash
npm run prisma:generate
npm run prisma:migrate
```

5. Запустите backend и frontend:

```bash
npm run dev
```

Frontend будет доступен на `http://localhost:5173`, API на `http://localhost:4000`.

## Telegram Mini App

1. Создайте бота через BotFather и получите `BOT_TOKEN`.
2. Запишите токен в `.env`.
3. Для production выключите локальный fallback:

```env
DEV_TELEGRAM_AUTH="false"
```

4. Поднимите frontend через HTTPS tunnel, например ngrok или Cloudflare Tunnel.
5. Укажите HTTPS URL Mini App в BotFather.

Backend принимает только `initData` от Telegram, проверяет подпись через `BOT_TOKEN`, создает или обновляет пользователя по `telegram_id` и возвращает JWT для REST API и Socket.IO.

Админские права выдаются пользователям, чей Telegram ID указан в `ADMIN_TELEGRAM_IDS`. В локальном dev-режиме `DEV_TELEGRAM_ID` также получает роль `ADMIN`.

## Ручная модерация администратора

Только пользователь с ролью `ADMIN` видит в подменю у чужого ника дополнительные иконки: блокировка доступа к чату, молчанка на 1 час, тюрьма на 1 сутки и снятие всех ручных санкций. Сервер проверяет роль для каждого действия; скрытая кнопка не даёт доступа без роли.

В собственном профиле администратор видит краткую подсказку по этим иконкам. Все ручные действия записываются в `admin_moderation_actions` с администратором, целью и результатом санкции.

## Локальная разработка вне Telegram

По умолчанию `.env.example` включает:

```env
DEV_TELEGRAM_AUTH="true"
```

Если frontend открыт не внутри Telegram и `initData` пустой, backend создаст dev-пользователя из переменных `DEV_TELEGRAM_*`. В production этот режим нужно отключить.

## API

Публичные endpoints:

- `GET /health`
- `POST /api/auth/telegram`

Все остальные endpoints требуют `Authorization: Bearer <token>`:

- `GET /api/me`
- `GET /api/users`
- `GET /api/blocks`
- `POST /api/blocks/:userId`
- `DELETE /api/blocks/:userId`
- `GET /api/public/messages?limit&before`
- `POST /api/public/messages`
- `GET /api/private/dialogs`
- `GET /api/private/messages/:userId?limit&before`
- `POST /api/private/messages`

Socket.IO подключается к API origin и принимает JWT в `auth.token`. События:

- `public:message`
- `private:message`
- `private:dialog:update`

## Пользовательская блокировка

В меню ника и в профиле можно заблокировать или разблокировать пользователя. Блокировка работает серверно:

- заблокированный пользователь не может писать вам приватно;
- вы не можете писать приватно заблокированному пользователю;
- история и realtime-лента общего чата скрывают сообщения заблокированных авторов;
- приватные диалоги с заблокированными пользователями скрываются.

## Лёгкая модерация общего чата

`POST /api/public/messages` проверяется простым серверным ботом-модератором. Он не использует внешние API и ловит явные грубости, угрозы, оскорбления и непристойное содержимое на русском, английском и японском с базовой нормализацией обфускаций.

Приватные сообщения не мониторятся этим ботом.

Санкции применяются только к общему чату:

- первое лёгкое нарушение: сообщение не публикуется, пользователь получает предупреждение;
- повторное лёгкое нарушение в окне `CHAT_MODERATION_RECURRENCE_WINDOW_HOURS`: мут общего чата на 15 минут;
- третье нарушение отправляет игрока в тюрьму на 1 день;
- дальнейшие рецидивы усиливают тюрьму: 3 дня, 7 дней, 30 дней;
- более тяжёлый смысл сообщения, например угрозы, может дать мут сразу.

История срабатываний хранится в `chat_moderation_events`, активный мут общего чата хранится в `users.public_muted_until`, активная тюрьма хранится в `users.jailed_until`. Модерацию можно отключить через `CHAT_MODERATION_ENABLED="false"`.

## Личные сообщения в общем чате

В общем чате можно отправить личное сообщение командой:

```text
/r nick текст сообщения
```

`nick` может быть `@username`, username без `@` или `id<ID>`, например `/r @dev_two привет`.
Личное сообщение отображается в общей ленте только у двух участников и помечается зелёной меткой `Лично`.
На мобильном можно зажать ник пользователя в сообщении и выбрать `Написать приватно`; поле ввода заполнится префиксом `/r nick`.

## Проверки

```bash
npm run typecheck
npm run build
npm run test
```

## Ограничения MVP

- Нет email/password регистрации.
- Нет групп, каналов, файлов, реакций и голосовых сообщений.
- Максимальная длина сообщения: 1000 символов.
- Список пользователей не возвращает `telegram_id` других пользователей.
