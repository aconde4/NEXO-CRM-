/**
 * Cliente de base de datos (Drizzle + postgres-js).
 *
 * Usa el pooler de Supabase en la app (DATABASE_URL). `prepare: false` es
 * necesario cuando se usa PgBouncer en modo "transaction" (pooler de Supabase).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

function createDatabase() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "Falta DATABASE_URL. Copia .env.example a .env.local y rellena la conexión de Supabase.",
    );
  }

  const client = postgres(connectionString, { prepare: false });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDatabase>;

let dbInstance: Database | null = null;

export function getDb(): Database {
  dbInstance ??= createDatabase();
  return dbInstance;
}

export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const database = getDb();
    const value = Reflect.get(database, prop, receiver);
    return typeof value === "function" ? value.bind(database) : value;
  },
});
