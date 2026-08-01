import { readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runner } from "node-pg-migrate";
import pg from "pg";
import env from "../utils/envHelper.ts";

const { Pool } = pg;

const MIGRATIONS_TABLE = "pgmigrations";
const BASELINE_MIGRATION_NAME = "202604130001_baseline-schema";
const migrationsDirectory = fileURLToPath(
  new URL("../../migrations", import.meta.url),
);

const silentLogger = {
  info: (_message: string) => {},
  warn: (_message: string) => {},
  error: (_message: string) => {},
};

const buildDatabaseUrl = () => {
  if (env.DATABASE_URL) {
    return env.DATABASE_URL;
  }
  return `postgresql://${encodeURIComponent(env.DB_USER)}:${encodeURIComponent(
    env.DB_PASSWORD,
  )}@${env.DB_HOST_NAME}:${env.DB_PORT}/${env.DB_NAME}`;
};

const runMigrations = async (
  direction: "up" | "down",
  count?: number,
): Promise<unknown[]> => {
  return runner({
    databaseUrl: buildDatabaseUrl(),
    dir: migrationsDirectory,
    direction,
    migrationsTable: MIGRATIONS_TABLE,
    createMigrationsSchema: true,
    logger: silentLogger,
    ...(typeof count === "number" ? { count } : {}),
  });
};

const getMigrationStatus = async () => {
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((fileName) => fileName.endsWith(".sql"))
    .map((fileName) => fileName.replace(/\.sql$/u, ""))
    .sort();

  const statusPool = new Pool({ connectionString: buildDatabaseUrl() });
  try {
    const tableExists = await statusPool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1
       ) AS exists`,
      [MIGRATIONS_TABLE],
    );

    if (!tableExists.rows[0]?.exists) {
      return {
        applied: [] as string[],
        pending: migrationFiles,
      };
    }

    const appliedResult = await statusPool.query<{ name: string }>(
      `SELECT name
       FROM ${MIGRATIONS_TABLE}
       ORDER BY id ASC`,
    );
    const applied = appliedResult.rows.map((row) => row.name);
    const pending = migrationFiles.filter(
      (fileName) => !applied.includes(fileName),
    );

    return { applied, pending };
  } finally {
    await statusPool.end();
  }
};

const printMigrationStatus = async () => {
  const { applied, pending } = await getMigrationStatus();

  console.log("Applied migrations:");
  if (applied.length === 0) {
    console.log("- none");
  } else {
    for (const migration of applied) {
      console.log(`- ${migration}`);
    }
  }

  console.log("Pending migrations:");
  if (pending.length === 0) {
    console.log("- none");
  } else {
    for (const migration of pending) {
      console.log(`- ${migration}`);
    }
  }
};

const entryPoint = process.argv[1];
const isDirectExecution =
  typeof entryPoint === "string" &&
  import.meta.url === pathToFileURL(entryPoint).href;

if (isDirectExecution) {
  const command = process.argv[2];

  void (async () => {
    if (command === "up") {
      await runMigrations("up");
      console.log("Migrations applied successfully");
      return;
    }

    if (command === "down") {
      await runMigrations("down", 1);
      console.log("Rolled back the latest migration");
      return;
    }

    if (command === "status") {
      await printMigrationStatus();
      return;
    }

    console.error("Usage: tsx src/config/db.migrate.ts <up|down|status>");
    process.exitCode = 1;
  })().catch((error) => {
    console.error("Migration command failed", error);
    process.exitCode = 1;
  });
}

export {
  BASELINE_MIGRATION_NAME,
  MIGRATIONS_TABLE,
  getMigrationStatus,
  runMigrations,
};
