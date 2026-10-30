import { getDatabase, migrateDatabase } from "./client";

// Unlike db:seed, keeps the data: this is how a deployed database gets new migrations
migrateDatabase(getDatabase())
  .then(() => console.log("Migrations applied."))
  .catch((error: unknown) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
