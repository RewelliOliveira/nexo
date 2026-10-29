import { createDatabase, migrateDatabase, type Database } from "./client";
import { seedDatabase } from "./seed-data";

/** Fresh in-memory database with the schema and the sample data. */
export async function createTestDatabase(now: Date): Promise<Database> {
  const db = createDatabase(":memory:");
  await migrateDatabase(db);
  await seedDatabase(db, now);
  return db;
}
