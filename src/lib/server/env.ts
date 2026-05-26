function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  get databaseUrl() {
    return getRequiredEnv("DATABASE_URL");
  },
  get jwtAccessSecret() {
    return getRequiredEnv("JWT_ACCESS_SECRET");
  },
  get jwtRefreshSecret() {
    return getRequiredEnv("JWT_REFRESH_SECRET");
  },
  get accessTokenTtl() {
    return process.env.ACCESS_TOKEN_TTL ?? "15m";
  },
  get refreshTokenTtl() {
    return process.env.REFRESH_TOKEN_TTL ?? "30d";
  }
};
