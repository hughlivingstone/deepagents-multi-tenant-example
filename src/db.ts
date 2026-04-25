import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { PostgresStore } from "@langchain/langgraph-checkpoint-postgres/store";
import pg from "pg";

const { Pool } = pg;

export interface Persistence {
  pool: pg.Pool;
  store: PostgresStore;
  checkpointer: PostgresSaver;
}

export async function createPersistence(databaseUrl: string): Promise<Persistence> {
  const pool = new Pool({ connectionString: databaseUrl });

  const store = PostgresStore.fromConnString(databaseUrl);
  await store.setup();

  const checkpointer = PostgresSaver.fromConnString(databaseUrl);
  await checkpointer.setup();

  return { pool, store, checkpointer };
}

export interface StoreRow {
  namespacePath: string;
  key: string;
  value: unknown;
}

export async function listStoreRows(
  pool: pg.Pool,
  namespacePath: string,
): Promise<StoreRow[]> {
  const result = await pool.query<{
    namespace_path: string;
    key: string;
    value: unknown;
  }>(
    `SELECT namespace_path, key, value
       FROM store
      WHERE namespace_path = $1
      ORDER BY key ASC`,
    [namespacePath],
  );

  return result.rows.map((row) => ({
    namespacePath: row.namespace_path,
    key: row.key,
    value: row.value,
  }));
}
