# Node-pg-migrate Workflow Guide

This guide explains how `node-pg-migrate` is integrated into this project to manage our database schema history. The goal is to understand the end-to-end flow of how the migration scripts run and where things are executed, rather than the SQL logic inside the migrations themselves.

---

## 1. Top-Level Entry Points (`package.json`)

The migration process is driven entirely by NPM scripts defined in `package.json`. These are the commands you use in your terminal.

```json
"scripts": {
  "migrate:create": "node-pg-migrate create --migration-file-language sql -m migrations",
  "migrate:up": "tsx src/config/db.migrate.ts up",
  "migrate:down": "tsx src/config/db.migrate.ts down",
  "migrate:status": "tsx src/config/db.migrate.ts status",
  "db:seed": "tsx src/config/db.seed.ts"
}
```

### What these do:

- **`migrate:create <name>`**: This uses the `node-pg-migrate` CLI directly to generate a blank timestamped `.sql` file inside the `migrations/` directory.
- **`migrate:up`, `migrate:down`, `migrate:status`**: Notice that these do _not_ call `node-pg-migrate` directly. Instead, they run a custom wrapper file we created `src/config/db.migrate.ts`.
- **`db:seed`**: Running the seed is entirely separate from migrations (more on this below).

---

## 2. The Custom Runner Wrapper (`src/config/db.migrate.ts`)

Instead of giving `node-pg-migrate` raw database credentials via the command line, we use its **Programmatic API** via `src/config/db.migrate.ts`.

This file acts as the bridge between your `package.json` scripts and the migration tool.

### Responsibilities of `db.migrate.ts`:

1.  **Connection Building:** It reads the `envHelper.ts` to get access to your standard environment variables (like `DB_USER` and `DB_PASSWORD`) and builds the connection string on the fly.
2.  **Configuration:** It calls `node-pg-migrate`'s `runner()` function and provides it with exactly where your migrations live (`dir: migrationsDirectory`) and what tracking table to use.
3.  **Command Execution:** It intercepts the arguments (`up`, `down`, `status`) passed from NPM:
    - If `up`, it tells the tool to run all pending migrations.
    - If `down`, it sets a `count: 1` limit to only roll back the single most recent migration.
    - If `status`, it queries the database manually to list out which files have been applied versus which are pending.

This custom runner ensures migrations are executed in exactly the same context as your application, without needing duplicate connection strings floating around.

---

## 3. The Migration Files (`migrations/` Directory)

All migrations live in the `migrations/` directory.

Because we passed the flag `--migration-file-language sql` in `migrate:create`, it generates `.sql` files instead of `.js` files.

### Structure of a `.sql` migration file:

```sql
-- Up Migration
CREATE TABLE users (...);

-- Down Migration
DROP TABLE users;
```

When you run `migrate:up`, the `node-pg-migrate` tool reads the SQL above the `-- Down Migration` comment. When you run `migrate:down`, it reads the SQL below it.

---

## 4. State Tracking (`pgmigrations` Table)

`node-pg-migrate` needs to know which files it has already run. It does this automatically via a tracking table.

Because of our configuration in `db.migrate.ts`, the tool automatically:

1.  Creates a table named `pgmigrations` the very first time you run `migrate:up`.
2.  After successfully running a migration file (like `202604130001_baseline-schema.sql`), it inserts a row into `pgmigrations` containing the filename (excluding the `.sql` extension).

The next time you run `migrate:up`, the tool compares the list of files in your `migrations/` folder against the rows in the `pgmigrations` table. It only executes the files that are not present in the table. This is what makes the command **idempotent** (safe to run over and over).

---

## 5. Separation of Concerns: Schemas vs. Data

It's vital to recognize what `node-pg-migrate` does **NOT** do in this project: **it does not handle data seeding.**

1.  **Migrations (`migrations/*.sql`)**: Strictly for establishing database structure (tables, constraints, indexes).
2.  **Seeding (`src/config/db.seed.ts`)**: Strictly for inserting base application data (roles, permissions) after the tables exist.

This is why `db:seed` is a totally separate script. If you drop your database, the workflow to restore it is:

1.  Run `pnpm run migrate:up` (Builds out all tables and tracks them).
2.  Run `pnpm run db:seed` (Inserts the initial RBAC configuration data).

---

## 6. End-to-End Workflow Summary

1.  **Creation:** Developer runs `pnpm run migrate:create add_users_table`. The tool generates an empty `timestamp_add_users_table.sql` file.
2.  **Authoring:** Developer writes the `CREATE TABLE` and `DROP TABLE` code inside that file.
3.  **Execution:** Developer runs `pnpm run migrate:up`.
4.  **The Runner:** `db.migrate.ts` compiles the DB connection string from `.env` and boots up the `node-pg-migrate` programmatic runner.
5.  **Tracking:** The runner connects to PostgreSQL, checks the `pgmigrations` table, realizes the new file hasn't been run, and applies the `Up` SQL.
6.  **Recording:** The runner inserts `timestamp_add_users_table` into `pgmigrations` so it won't be run again.
