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

  const pool = new Pool({ connectionString: env.databaseUrl });

  if (process.env.NODE_ENV !== "production") {
    global.__lakLearnPool = pool;
  }

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
