import { getDatabase, migrateDatabase } from "./client";
import {
  SEED_EMPLOYEES,
  SEED_KB_ARTICLES,
  resetDatabase,
  seedDatabase,
} from "./seed-data";

async function main(): Promise<void> {
  const db = getDatabase();

  await resetDatabase(db);
  await migrateDatabase(db);
  await seedDatabase(db);

  console.log(
    `Seeded ${SEED_EMPLOYEES.length} employees and ${SEED_KB_ARTICLES.length} help center articles.`,
  );
}

main().catch((error: unknown) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
