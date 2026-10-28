function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

// Минимальная длина JWT-секрета. 32 символа ≈ 192 бита при случайной генерации
// (`openssl rand -base64 48`). Короткий секрет HMAC можно подобрать перебором.
const MIN_SECRET_LENGTH = 32;

// Значения-заглушки, которые встречались в .env.example и docker-compose.
// С ними любой, кто видел репозиторий, может подделать токен администратора.
const PLACEHOLDER_PATTERN = /^(change_me|changeme|secret|your[_-]?secret)/i;

/**
 * Возвращает секрет, только если он пригоден для подписи токенов.
 * Иначе бросает ошибку: лучше упасть на первом запросе, чем молча
 * работать с секретом, который знают все.
 */
function getSecretEnv(name: string): string {
  const value = getRequiredEnv(name);

  if (PLACEHOLDER_PATTERN.test(value)) {
    throw new Error(`${name} содержит значение-заглушку. Сгенерируйте секрет: openssl rand -base64 48`);
  }

  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(`${name} слишком короткий (${value.length} < ${MIN_SECRET_LENGTH}). Сгенерируйте: openssl rand -base64 48`);
  }

  return value;
}

export const env = {
  get databaseUrl() {
    return getRequiredEnv("DATABASE_URL");
  },
  get dbPoolMax() {
    const parsed = Number(process.env.DB_POOL_MAX ?? 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
  },
  get jwtAccessSecret() {
    return getSecretEnv("JWT_ACCESS_SECRET");
  },
  get jwtRefreshSecret() {
    const refresh = getSecretEnv("JWT_REFRESH_SECRET");

    // Одинаковые секреты позволяют выдать access-токен за refresh и наоборот
    if (refresh === process.env.JWT_ACCESS_SECRET) {
      throw new Error("JWT_REFRESH_SECRET должен отличаться от JWT_ACCESS_SECRET");
    }

    return refresh;
  },
  get accessTokenTtl() {
    return process.env.ACCESS_TOKEN_TTL ?? "15m";
  },
  get refreshTokenTtl() {
    return process.env.REFRESH_TOKEN_TTL ?? "30d";
  }
};
