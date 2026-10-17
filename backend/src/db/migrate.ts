import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(process.cwd(), "../.env") });
loadEnv();

import { runMigrations, closeDbPool } from "./index.js";

async function main() {
  console.log("[Migration] Running CareConnect database migrations...");
  try {
    await runMigrations();
    console.log("[Migration] Migration completed successfully.");
  } catch (err) {
    console.error("[Migration] Migration failed:", err);
    process.exit(1);
  } finally {
    await closeDbPool();
  }
}

main();
