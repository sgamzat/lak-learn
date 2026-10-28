#!/usr/bin/env node
// Создание или обновление администратора без хранения пароля в репозитории.
//
// Использование:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='длинный-пароль' npm run admin:create
//   (в Docker) docker compose exec -e ADMIN_EMAIL=... -e ADMIN_PASSWORD='...' app node scripts/create-admin.mjs
//
// Если пользователь с таким email уже есть — ему выставляется новый пароль,
// роль admin и снимается блокировка. Все его refresh-сессии отзываются.
//
// Формат хеша совпадает с src/lib/server/password.ts (PBKDF2-SHA512, 120 000 итераций).

import { pbkdf2 as pbkdf2Callback, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const pbkdf2 = promisify(pbkdf2Callback);
const ITERATIONS = 120_000;
const KEY_LEN = 64;
const DIGEST = "sha512";
const MIN_PASSWORD_LENGTH = 12;

function fail(message) {
  console.error(`Ошибка: ${message}`);
  process.exit(1);
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await pbkdf2(password, salt, ITERATIONS, KEY_LEN, DIGEST);
  return `${ITERATIONS}:${salt}:${hash.toString("hex")}`;
}

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const displayName = process.env.ADMIN_NAME?.trim() || "Admin";
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) fail("не задан DATABASE_URL");
if (!email || !email.includes("@")) fail("задайте корректный ADMIN_EMAIL");
if (!password || password.length < MIN_PASSWORD_LENGTH) {
  fail(`ADMIN_PASSWORD должен быть не короче ${MIN_PASSWORD_LENGTH} символов`);
}

const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query("BEGIN");

  const role = await client.query("SELECT id FROM roles WHERE code = 'admin'");
  if (role.rowCount === 0) fail("роль admin не найдена — сначала примените миграции");

  const passwordHash = await hashPassword(password);

  const result = await client.query(
    `
      INSERT INTO users (email, password_hash, role_id, display_name, is_blocked)
      VALUES ($1, $2, $3, $4, FALSE)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        role_id       = EXCLUDED.role_id,
        is_blocked    = FALSE,
        updated_at    = NOW()
      RETURNING id, (xmax = 0) AS created
    `,
    [email, passwordHash, role.rows[0].id, displayName]
  );

  const { id, created } = result.rows[0];

  await client.query(
    `
      INSERT INTO user_progress (user_id, xp, streak_days, learned_words)
      VALUES ($1, 0, 0, 0)
      ON CONFLICT (user_id) DO NOTHING
    `,
    [id]
  );

  // Старые сессии с прежним паролем больше не действительны
  await client.query(
    "UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
    [id]
  );

  await client.query("COMMIT");
  console.log(created ? `Администратор создан: ${email}` : `Администратор обновлён: ${email}`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await client.end();
}
