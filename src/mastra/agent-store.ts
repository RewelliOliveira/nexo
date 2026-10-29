import { LibSQLStore } from "@mastra/libsql";
import { resolveDatabaseUrl } from "@/lib/project-root";

/**
 * Where the agent memory lives: a hosted database when deployed
 * (mastra env db create --kind turso), a local file during development.
 */
export function createAgentStore(): LibSQLStore {
  return new LibSQLStore({
    id: "mastra-storage",
    url: resolveDatabaseUrl(process.env.TURSO_DATABASE_URL || "file:./mastra.db"),
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}
