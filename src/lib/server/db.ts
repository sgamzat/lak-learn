import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { env } from "@/lib/server/env";

declare global {
  // eslint-disable-next-line no-var
  var __lakLearnPool: Pool | undefined;
}

function getPool(): Pool {
  if (global.__lakLearnPool) {
    return global.__lakLearnPool;
  }

  // Пул кешируется ВСЕГДА: и в dev (переживает hot reload), и в production.
  // Раньше в production на каждый query() создавался новый Pool, соединения
  // копились и Postgres упирался в лимит "too many clients".
  const pool = new Pool({
    connectionString: env.databaseUrl,
    max: env.dbPoolMax,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    // JIT-компиляция Postgres для коротких запросов приложения только мешает:
    // очередь повторения выполнялась 1,17 с, из них 1,09 с — JIT; без него 54 мс
    options: "-c jit=off"
  });

  // Ошибка простаивающего соединения (например, рестарт Postgres) не должна ронять процесс
  pool.on("error", (error) => {
    console.error("[db] idle client error:", error.message);
  });

  global.__lakLearnPool = pool;
  return pool;
}

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
