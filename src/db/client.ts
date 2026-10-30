import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { getProjectRoot, resolveDatabaseUrl } from "@/lib/project-root";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDatabase>;

const MIGRATIONS_FOLDER = path.join(getProjectRoot(), "src/db/migrations");

/**
 * Creates a Drizzle client over libSQL. Uses a local file in development and
 * Turso when DATABASE_URL points to a remote database.
 */
export function createDatabase(url: string, authToken?: string) {
  const client = createClient({ url: resolveDatabaseUrl(url), authToken });
  return drizzle(client, { schema });
}

export async function migrateDatabase(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

let defaultDatabase: Database | undefined;

/** Shared database instance configured from the environment. */
export function getDatabase(): Database {
  defaultDatabase ??= createDatabase(
    process.env.DATABASE_URL || "file:nexo.db",
    process.env.DATABASE_AUTH_TOKEN,
  );
  return defaultDatabase;
}
