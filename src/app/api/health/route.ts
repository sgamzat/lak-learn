import { NextResponse } from "next/server";
import { env } from "@/lib/server/env";

// Healthcheck контейнера (docker-compose: app → healthy → nginx стартует).
// Проверяем конфигурацию: с неверными JWT-секретами приложение не может
// выдать ни одного токена, и лучше узнать об этом при `docker compose up`,
// а не на первом входе пользователя.
export async function GET() {
  try {
    void env.databaseUrl;
    void env.jwtAccessSecret;
    void env.jwtRefreshSecret;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[health] Ошибка конфигурации: ${message}`);
    // Подробности — только в логах контейнера, наружу не отдаём
    return NextResponse.json({ ok: false, error: "configuration" }, { status: 503 });
  }

  return NextResponse.json({ ok: true, service: "lak-learn-app" }, { status: 200 });
}

// Иначе Next может отдать статически собранный ответ, не проверив окружение
export const dynamic = "force-dynamic";
