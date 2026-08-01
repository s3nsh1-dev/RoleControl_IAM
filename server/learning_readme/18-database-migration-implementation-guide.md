# Database Migration Implementation Guide For This Project

> This guide is written specifically for this RBAC project and assumes you have **never done database migrations before**. Every concept is explained from scratch before being applied. If a step says "do X," the preceding paragraph explains *why*.

---

## Table Of Contents

1. [The Problem We Are Solving](#1-the-problem-we-are-solving)
2. [What Is A Database Migration?](#2-what-is-a-database-migration)
3. [Key Vocabulary You Need First](#3-key-vocabulary-you-need-first)
4. [Why This Project Specifically Needs Migrations](#4-why-this-project-specifically-needs-migrations)
5. [The Important Split: Schema vs Seed Data](#5-the-important-split-schema-vs-seed-data)
6. [Which Migration Tool And Why](#6-which-migration-tool-and-why)
7. [Phase-By-Phase Implementation](#7-phase-by-phase-implementation)
8. [Exact Baseline Migration Scope](#8-exact-baseline-migration-scope)
9. [How Future Migrations Work After The Baseline](#9-how-future-migrations-work-after-the-baseline)
10. [Common First-Time Mistakes And How To Avoid Them](#10-common-first-time-mistakes-and-how-to-avoid-them)
11. [What To Update After Adding Migrations](#11-what-to-update-after-adding-migrations)
12. [Quick Reference Summary](#12-quick-reference-summary)

---

## 1. The Problem We Are Solving

Before touching any migration tool, let us understand the actual problem in plain language.

### How the database works right now

Open [db.setup.ts](file:///home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/config/db.setup.ts). This file is what `pnpm run dbprep` executes. Here is what it does, step by step:

1. **Drops every table** — `DROP TABLE IF EXISTS audit_logs, user_sessions, posts, role_permissions, user_roles, permissions, roles, users CASCADE;`
2. **Creates every table from scratch** — all 8 tables, all constraints, all indexes
3. **Result** — a perfectly clean, empty database

**Every single time you need to change anything in the schema** (add a column, rename a table, add a new index), you:

1. Edit `db.setup.ts`
2. Run `pnpm run dbprep`
3. **Lose every row of data** — every user, every post, every role assignment, every audit log, everything

### Why that is actually fine — until now

For learning and initial development, this is completely valid. You were building the structure from zero. There was no data worth keeping. If everything vanished, you could recreate test users in seconds.

### Why that stops being fine

Imagine these real scenarios:

**Scenario A — You want to add a `last_login_at` column to `users`**

What you want to happen:
- Add one column to an existing table
- Keep all existing users, their passwords, their role assignments, their session history

What actually happens with `dbprep`:
- Every user deleted
- Every role assignment deleted
- Every session deleted
- Every audit log deleted
- You get one new empty column, but lose everything else

**Scenario B — You have been testing RBAC flows for days and accumulated real audit trail data**

What you want:
- Keep all that valuable test history
- Maybe add an index to speed up audit log queries

What `dbprep` gives you:
- A fast new index on a table that now has zero rows

**Scenario C — In a real production environment**

- You have 10,000 real users
- You need to add one column
- `dbprep` would delete all 10,000 users

This is the problem migrations solve.

---

## 2. What Is A Database Migration?

### The simplest possible explanation

A migration is a **single, numbered file that describes one change to your database**.

That is it. Really.

- Migration 001: "Create the `users` table"
- Migration 002: "Create the `roles` table"
- Migration 003: "Add `last_login_at` column to `users`"
- Migration 004: "Add an index on `audit_logs.actor_id`"

Each migration is applied **in order**, and the database **remembers which ones have already been applied**.

### The Git analogy

This is the best mental model. You already understand Git:

| Git (code versioning) | Migrations (database versioning) |
|---|---|
| A **commit** records a change to your code | A **migration** records a change to your database |
| You never go back and edit old commits | You never edit old migrations that have already been run |
| `git log` shows the history of code changes | The migrations folder shows the history of database changes |
| You can revert to an old commit | You can roll back a migration |
| New developers run `git clone` to get all code history | New developers run `migrate up` to build the database from scratch |

### Before migrations vs after migrations

```
BEFORE MIGRATIONS (current state):
┌──────────────────────────────────────────────────┐
│ db.setup.ts                                      │
│                                                  │
│  "Here is the ENTIRE database. Every time you    │
│   run me, I destroy everything and rebuild."     │
│                                                  │
│  It is a snapshot. One file. All or nothing.      │
└──────────────────────────────────────────────────┘

AFTER MIGRATIONS (target state):
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Migration 001   │  │ Migration 002   │  │ Migration 003   │
│                 │→ │                 │→ │                 │→ ...
│ Create all      │  │ Add column X    │  │ Add index Y     │
│ original tables │  │ to users table  │  │ on audit_logs   │
└─────────────────┘  └─────────────────┘  └─────────────────┘

Each migration is ONE change. Applied in order. Data is preserved.
```

---

## 3. Key Vocabulary You Need First

Before we go further, here are the exact terms you will encounter, explained for someone seeing them for the first time.

### Migration file
A single file (usually SQL or JavaScript/TypeScript) that describes **one schema change**. It lives in a `migrations/` folder and has a timestamp or number in its filename so the tool knows the order.

Example filename: `1681234567890_create-users-table.sql`

### Up migration
The **forward direction** — what this migration does when applied. "Create this table," "add this column," "create this index."

### Down migration
The **reverse direction** — how to undo this migration. "Drop this table," "remove this column," "drop this index." Think of it as the undo button. You do not always need a perfect down migration, but you should always *think* about whether a migration can be reversed.

### Baseline migration
The **very first migration** that captures your existing database exactly as it is today. It does not change anything — it simply says "this is the starting point." Every future migration builds on top of it.

In our case, the baseline will contain everything that `db.setup.ts` currently creates: all 8 tables, all constraints, all indexes.

### Migration table
When you run a migration tool, it creates a **special tracking table** in your database (usually called `pgmigrations` or similar). This table records which migrations have already been applied. That is how the tool knows "migration 001 is already done, I should start from 002."

### Schema
The **structure** of your database — what tables exist, what columns they have, what types those columns are, what constraints and indexes exist. Schema is about structure, not data.

### Seed data
**Initial rows** that need to exist for the application to function. In this project, that means the roles (`super-admin`, `admin`, `editor`, `user`), the permissions (`view:user`, `create:post`, etc.), and the role-permission mappings. Seed data is **not** schema — it is data.

### Destructive reset
What `pnpm run dbprep` does right now — wipe everything and start over. After migrations exist, you will still keep this for tests, but you will stop using it as the normal way to set up the app database.

---

## 4. Why This Project Specifically Needs Migrations

This is not theoretical. Here is what already exists in your database that would be destroyed by a schema change today.

### Data this project creates and tracks

| Table | What it holds | Why losing it hurts |
|---|---|---|
| `users` | Registered users with hashed passwords | Re-registering users and re-assigning roles is tedious |
| `roles` | The 4 RBAC roles | Must be re-seeded before anything works |
| `permissions` | All action:resource combos | Must be re-seeded, and IDs may change if re-inserted in different order |
| `user_roles` | Which user has which role | The core RBAC relationship — losing it breaks authorization completely |
| `role_permissions` | Which role grants which permission | Defines what each role can do — losing it disables the whole RBAC system |
| `posts` | User-created content | Test data or real content, gone |
| `user_sessions` | Active refresh tokens | Every user gets logged out and cannot refresh |
| `audit_logs` | Who did what and when | The entire accountability trail vanishes |

### The real cost

Without migrations, every developer (including you) learns this workflow:

1. "I need to add a column"
2. Run `pnpm run dbprep`
3. Re-register users via the `/api/auth/register` endpoint
4. Re-assign roles via the admin endpoints
5. Re-create any test posts
6. Hope you remember what state you were testing

**With migrations**, the workflow becomes:

1. "I need to add a column"
2. Create a migration file: `ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;`
3. Run `pnpm run migrate:up`
4. Done. All users, roles, sessions, audit logs still intact

---

## 5. The Important Split: Schema vs Seed Data

This is a concept that trips up many beginners. Before writing any migration, you need to understand what goes *into* a migration and what does *not*.

### What is schema?

Schema is the **structure** of your database:

- Tables (their existence, their column names and types)
- Constraints (unique, foreign key, check constraints)
- Indexes

Schema answers: **"What containers exist and what shape are they?"**

### What is seed data?

Seed data is the **initial rows** that your application needs to function:

- The 4 roles: `super-admin`, `admin`, `editor`, `user`
- All the permissions: `view:user`, `create:post`, `assign:role`, etc.
- The role-permission mappings: "admin can `assign:role` and `delete:user`"

Seed data answers: **"What initial data goes into those containers?"**

### Why this matters

**Migrations should own schema.** Every `CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX` goes into migration files.

**A separate seed/bootstrap script should own seed data.** Inserting roles, permissions, and mappings stays in a seed script.

Why? Because they evolve differently:

- Schema changes are **structural** and must happen in strict order (you cannot add a column to a table that does not exist yet)
- Seed data is **idempotent** — you should be able to run it multiple times and get the same result (insert role `admin` only if it does not already exist)

### What this means for this project

Right now, [tests/support/database.ts](file:///home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/tests/support/database.ts) already has a `seedReferenceRbac()` function that inserts roles, permissions, and mappings from [hierarchy.ts](file:///home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/config/hierarchy.ts) and [constants.ts](file:///home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/others/constants.ts). That function is your seed logic — it already exists. You will just need to make it available outside of tests too.

| Goes into migrations | Goes into seed script |
|---|---|
| `CREATE TABLE users (...)` | `INSERT INTO roles (name, description) VALUES ('admin', '...')` |
| `ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ` | `INSERT INTO permissions (action, resource) VALUES ('view', 'user')` |
| `CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id)` | `INSERT INTO role_permissions (role_id, permission_id) VALUES (...)` |
| `ALTER TABLE posts ADD CONSTRAINT ...` | Creating the initial super-admin user |

---

## 6. Which Migration Tool And Why

### The recommendation: `node-pg-migrate`

There are many migration tools for Node.js + PostgreSQL. For *this* project, `node-pg-migrate` is the best fit. Here is why:

| Factor | Why `node-pg-migrate` is the right choice |
|---|---|
| You already use raw `pg` (no ORM) | `node-pg-migrate` works directly with `pg` — no new abstraction layer |
| Your project is SQL-centric | Migration files can be plain SQL — you already know how to write the SQL |
| First time doing migrations | It is simple and focused — it does one thing well |
| You want to learn PostgreSQL deeply | It keeps you close to real PostgreSQL DDL statements |

### Why not other tools?

- **Drizzle Kit** — Excellent tool, but it introduces a schema-definition-in-TypeScript workflow that changes how you think about your database. Too big a workflow shift right now.
- **Knex** — Also good, but it adds a query builder layer you do not need. Your project already uses raw SQL queries everywhere.
- **Prisma Migrate** — Requires adopting the full Prisma ORM. Way too much change for this project.

The principle: **the migration tool should fit your existing workflow, not force you into a new one.**

---

## 7. Phase-By-Phase Implementation

Here is the complete implementation plan, broken into small phases. Each phase is explained with its *why* before the *what*.

### Overview flowchart

```
Phase 1          Phase 2              Phase 3              Phase 4
Install tool  →  Create baseline   →  Separate schema   →  Update dev
& add scripts    migration from       from seed logic      workflow
                 db.setup.ts

Phase 5                  Phase 6
Keep destructive      →  Add migration-specific
reset for tests          tests later (v3)
```

---

### Phase 1: Add migration tooling

**Why this phase exists:**
Before you can create any migration, you need the tool installed and configured. This is pure setup — installing `node-pg-migrate` and telling it where to find your database and where to store migration files.

**What to do:**

#### Step 1: Install the package

```bash
pnpm add node-pg-migrate
```

**Why:** This adds the migration CLI tool to your project. It will read your database connection from an environment variable and manage migration files.

#### Step 2: Decide where migration files live

Create a `migrations/` directory at the project root:

```
learn_RBAC_postgresql/
├── migrations/          ← NEW: all migration files go here
├── src/
├── tests/
├── docs/
├── ...
```

**Why:** Keeping migrations in a top-level directory makes them easy to find and clearly separates them from application source code. They are not part of `src/` because they do not get compiled or bundled — they are standalone SQL or JS files that the migration tool executes directly.

#### Step 3: Add migration scripts to `package.json`

Add these to the `"scripts"` section of [package.json](file:///home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/package.json):

```json
{
  "scripts": {
    "migrate:create": "node-pg-migrate create --migration-file-language sql -m migrations",
    "migrate:up": "node-pg-migrate up -m migrations",
    "migrate:down": "node-pg-migrate down -m migrations",
    "migrate:status": "node-pg-migrate list -m migrations"
  }
}
```

**What each command does:**

| Command | What it does | When you use it |
|---|---|---|
| `migrate:create` | Creates a new empty migration file in `migrations/` | When you want to make a schema change |
| `migrate:up` | Applies all pending migrations in order | When setting up the database, or after pulling new code that includes new migrations |
| `migrate:down` | Reverts the last applied migration | When you need to undo a recent schema change |
| `migrate:status` | Shows which migrations have been applied and which are pending | To check the current state of your database |

**Why the flags:**
- `-m migrations` tells the tool to look in the `migrations/` directory
- `--migration-file-language sql` makes `migrate:create` generate `.sql` files instead of `.js` files — since you are already comfortable writing SQL

#### Step 4: Configure the database connection

`node-pg-migrate` reads the database connection from the `DATABASE_URL` environment variable by default. You need to add this to your `.env`:

```env
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/your_database_name
```

**Why:** The migration tool needs to connect to the same database your app uses. It uses the standard PostgreSQL connection string format. Check your existing `.env` for the individual `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` values and combine them into this single URL.

---

### Phase 2: Create the baseline migration

**Why this phase exists:**
This is the most important step. Right now, your database schema lives inside `db.setup.ts` as code. You need to capture the *current* schema as your first migration — the "starting point" that all future migrations will build upon.

Think of it like this: if your code had no Git history and you wanted to start using Git, your first commit would be the code *as it exists right now*. You would not rewrite the code first. Same principle.

**What to do:**

#### Step 1: Generate the baseline migration file

```bash
pnpm run migrate:create -- baseline-schema
```

This creates a file like: `migrations/1681234567890_baseline-schema.sql`

**Why the name matters:** The filename starts with a timestamp (so the tool knows the order) and ends with a human-readable description. "baseline-schema" tells anyone reading it: "this is the initial schema capture."

#### Step 2: Write the `up` migration

Open the generated file. It will have two sections separated by comments:

```sql
-- Up Migration

-- Down Migration
```

In the **Up Migration** section, write the SQL that creates the *entire current schema*. This is essentially the same SQL that is currently in `db.setup.ts`, but without the `DROP TABLE` statements.

> **Critical rule:** The baseline migration captures the schema **exactly as it exists right now**. Do not fix naming, do not add columns, do not change types. That comes in later migrations. The first migration is a faithful snapshot.

The up section should create:
- All 8 tables (`users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `posts`, `user_sessions`, `audit_logs`)
- All constraints (unique, check, foreign keys)
- All indexes

See [Section 8](#8-exact-baseline-migration-scope) for the exact content.

#### Step 3: Write the `down` migration

In the **Down Migration** section, write the SQL that undoes everything the up migration did:

```sql
-- Down Migration
DROP TABLE IF EXISTS audit_logs, user_sessions, posts, role_permissions, user_roles, permissions, roles, users CASCADE;
```

**Why include a down migration?** If something goes wrong or you need to start completely fresh, the down migration lets you undo the up migration cleanly. For the baseline, the down migration is simply "drop everything" — because before the baseline, nothing existed.

#### Step 4: Test the baseline migration

Run the migration on an **empty database** to verify it works:

```bash
pnpm run migrate:up
```

**What happens behind the scenes:**
1. `node-pg-migrate` connects to your database
2. It looks for a table called `pgmigrations` — if it does not exist, it creates one
3. It checks `pgmigrations` to see which migrations have already been applied
4. It finds that `baseline-schema` has not been applied yet
5. It runs the up SQL
6. It inserts a row into `pgmigrations` recording that `baseline-schema` is now applied
7. Done

After this, running `pnpm run migrate:up` again does **nothing**, because the tool sees that all migrations are already applied. This is safe to run multiple times.

---

### Phase 3: Separate schema setup from seed/bootstrap logic

**Why this phase exists:**
Right now, `db.setup.ts` handles schema creation, and `seedReferenceRbac()` in the test support file handles inserting roles and permissions. After migrations take over schema creation, you need to make the seed logic available for normal development use, not just tests.

**What to do:**

#### Step 1: Create a standalone seed script

Create a new file, for example `src/config/db.seed.ts`, that:

1. Inserts the 4 roles (if they do not already exist)
2. Inserts all permissions (if they do not already exist)  
3. Creates the role-permission mappings (if they do not already exist)

**Why "if they do not already exist"?** Because seed scripts should be **idempotent** — safe to run multiple times. If the data is already there, it should not fail or create duplicates. Use `INSERT ... ON CONFLICT DO NOTHING` which you already use in your test support code.

You already have this logic in [tests/support/database.ts](file:///home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/tests/support/database.ts) in the `seedReferenceRbac()` function. You can extract it into a shared module that both the seed script and the test support can use.

#### Step 2: Add a seed script to `package.json`

```json
{
  "scripts": {
    "db:seed": "tsx src/config/db.seed.ts"
  }
}
```

**Why:** After running migrations (which create the empty tables), you need to populate the reference data. This command does that.

#### Step 3: Keep `db.setup.ts` — but change its role

Do **not** delete `db.setup.ts` yet. It is still needed for:
- Test setup (your tests call `resetDatabase()` which calls `prepareDatabase()`)
- Quick local reset when you want a totally clean slate

But mentally, its role changes from "the real schema setup" to "the destructive reset helper."

---

### Phase 4: Define the new development workflow

**Why this phase exists:**
Now that migrations exist, the way a developer (including you) sets up the project for the first time changes. You need to define and document this new workflow.

**The old workflow:**

```
1. Clone the repo
2. pnpm install
3. Set up .env
4. pnpm run dbprep        ← drops & recreates everything
5. Manually register a super-admin via the API
6. pnpm run dev
```

**The new workflow:**

```
1. Clone the repo
2. pnpm install
3. Set up .env (including DATABASE_URL)
4. Create the database if it does not exist
5. pnpm run migrate:up    ← builds schema from migration history, nothing destroyed
6. pnpm run db:seed       ← inserts roles, permissions, mappings
7. Register a super-admin via the API (or through a bootstrap script)
8. pnpm run dev
```

**Why this is better:**
- Step 5 can be run at any time without losing data
- If a teammate adds a new migration, you just run `migrate:up` and only the new changes are applied
- The database is built by replaying its *history*, not by running a destructive script

---

### Phase 5: Keep destructive reset only for tests

**Why this phase exists:**
Your test suite (v2-integration) depends on a completely clean database before each run. That is correct — tests should be isolated and repeatable. Migrations do not replace this.

**What to do:**

Keep the current test flow exactly as it is:

```typescript
// tests/v2-integration/index.test.ts
before(async () => {
  await resetDatabase();     // drops and recreates — still uses db.setup.ts
  await seedReferenceRbac(); // inserts roles, permissions, mappings
});
```

**Why this is fine:** Tests are **disposable environments**. They should start from a known state every time. The destructive reset is the right tool for this job.

The important distinction:

| Workflow | Uses migrations? | Uses destructive reset? |
|---|---|---|
| Normal development | ✅ Yes | ❌ No |
| Setting up a new dev machine | ✅ Yes | ❌ No |
| Running tests | ❌ No | ✅ Yes |
| Applying a schema change | ✅ Yes | ❌ No |
| Explicit local reset | Could use either | ✅ Yes |

---

### Phase 6: Add migration-specific tests later (v3)

**Why this phase exists:**
This is future work. Once migrations are stable and working, you may want to verify that the migrations themselves are correct. This is not urgent for the first implementation.

**What v3 tests would verify:**

- Baseline migration can build the schema from an empty database
- All migrations run in order without errors
- Seeds still work after migrations
- The app still behaves correctly after migrations (login, RBAC, posts, audit logging)

**Why later:** You already have v2 integration tests that cover app behavior. If the app works after migrations, you know the migrations are correct. Dedicated migration tests are a refinement, not a prerequisite.

---

## 8. Exact Baseline Migration Scope

Your baseline migration must capture everything that [db.setup.ts](file:///home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/src/config/db.setup.ts) currently creates. Here is the complete inventory:

### Tables (8 total)

| Table | Purpose | Key details |
|---|---|---|
| `users` | Registered accounts | `id SERIAL PK`, `email` unique, `created_by` self-referencing FK |
| `roles` | RBAC role definitions | `name` unique |
| `permissions` | Action-resource pairs | Unique `(action, resource)`, CHECK constraints on valid values |
| `user_roles` | User ↔ role assignments | Unique `(user_id, role_id)`, cascades on delete |
| `role_permissions` | Role ↔ permission grants | Unique `(role_id, permission_id)`, cascades on delete |
| `posts` | User content | `behalf_of != owner_id` check constraint |
| `user_sessions` | Refresh token sessions | `expires_at`, `revoked_at` for lifecycle management |
| `audit_logs` | Action audit trail | CHECK constraints on `action_type` and `resource_type` |

### Constraints to include

- `UNIQUE (email)` on `users`
- `UNIQUE (action, resource)` on `permissions`
- `UNIQUE (user_id, role_id)` on `user_roles`
- `UNIQUE (role_id, permission_id)` on `role_permissions`
- `CHECK (behalf_of IS NULL OR behalf_of != owner_id)` on `posts`
- `CHECK (action IN (...))` on `permissions`
- `CHECK (resource IN (...))` on `permissions`
- `CHECK (action_type IN (...))` on `audit_logs`
- `CHECK (resource_type IN (...))` on `audit_logs`
- All `REFERENCES` (foreign key) clauses with their `ON DELETE` behavior (`CASCADE` or `SET NULL`)

### Indexes to include (9 total)

| Index name | Table | Column(s) |
|---|---|---|
| `idx_users_created_by` | `users` | `created_by` |
| `idx_user_roles_role_id` | `user_roles` | `role_id` |
| `idx_role_permissions_permission_id` | `role_permissions` | `permission_id` |
| `idx_posts_owner_id` | `posts` | `owner_id` |
| `idx_posts_behalf_of` | `posts` | `behalf_of` |
| `idx_user_sessions_user_id` | `user_sessions` | `user_id` |
| `idx_user_sessions_expires_at` | `user_sessions` | `expires_at` |
| `idx_audit_logs_actor_id` | `audit_logs` | `actor_id` |
| `idx_audit_logs_resource_lookup` | `audit_logs` | `(resource_type, resource_id, created_at DESC)` |

### What NOT to include in the baseline migration

- ❌ Role rows (`INSERT INTO roles ...`) — that is seed data
- ❌ Permission rows (`INSERT INTO permissions ...`) — that is seed data
- ❌ Role-permission mapping rows — that is seed data
- ❌ Any `DROP TABLE` statements — migrations build forward, they do not destroy first
- ❌ Any schema redesign — capture current truth first, improve later

---

## 9. How Future Migrations Work After The Baseline

Once the baseline is in place, here is how future schema changes work.

### The golden rule

> **Never edit an old migration that has already been applied.**

If a migration has been run against any database, it is history. You do not go back and change history. You write a new migration.

### Example: Adding a column

Let's say you want to add `last_login_at` to the `users` table.

**Step 1:** Generate a new migration file

```bash
pnpm run migrate:create -- add-last-login-to-users
```

This creates: `migrations/1681999999999_add-last-login-to-users.sql`

**Step 2:** Write the SQL

```sql
-- Up Migration
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;

-- Down Migration
ALTER TABLE users DROP COLUMN last_login_at;
```

**Step 3:** Apply it

```bash
pnpm run migrate:up
```

**What happens:**
- The tool checks `pgmigrations` — baseline is already applied ✅
- The new migration is pending — it runs the up SQL
- The `users` table now has a `last_login_at` column
- All existing users still have their data — the new column is simply `NULL` for them
- The tool records this migration as applied

**Step 4:** Update your app code to use the new column

Now update your TypeScript types, queries, controllers to work with `last_login_at`.

### Example: Adding an index

```sql
-- Up Migration
CREATE INDEX idx_users_last_login ON users(last_login_at);

-- Down Migration
DROP INDEX idx_users_last_login;
```

### Example: Renaming a column (more complex)

```sql
-- Up Migration
ALTER TABLE posts RENAME COLUMN content TO body;

-- Down Migration
ALTER TABLE posts RENAME COLUMN body TO content;
```

**Important note:** After renaming a column, you must also update every query in your app code that references the old name. The migration handles the database side; you handle the code side.

### The migration timeline

After a few weeks of development, your migrations folder might look like this:

```
migrations/
├── 1681000000000_baseline-schema.sql
├── 1681100000000_add-last-login-to-users.sql
├── 1681200000000_add-index-on-users-last-login.sql
├── 1681300000000_add-device-info-to-audit-logs.sql
└── 1681400000000_add-status-column-to-posts.sql
```

Any developer can take an empty database and run `pnpm run migrate:up` to build the complete schema by replaying all migrations in timestamp order.

---

## 10. Common First-Time Mistakes And How To Avoid Them

### Mistake 1: Thinking migrations should drop and rebuild

**Wrong mental model:** "My migration command should drop everything and rebuild — that is what `dbprep` does."

**Correct mental model:** Migrations move the schema forward, one change at a time. They never destroy existing data. Destructive reset is a completely separate tool for tests and disposable environments.

### Mistake 2: Redesigning the schema while creating the baseline

**Wrong move:** "While I'm creating the baseline migration, let me also rename `behalf_of` to `on_behalf_of` and change `VARCHAR(255)` to `TEXT` and add a few new columns."

**Correct move:** The baseline captures the schema *as it is*. After the baseline is in place and tested, you can redesign through new, separate migrations.

**Why this matters:** If the baseline does not match what `db.setup.ts` creates, you have introduced inconsistency on day one. Your tests (which use `db.setup.ts`) will be testing against a different schema than what migrations produce.

### Mistake 3: Putting seed data into migrations

**Wrong:** Creating a migration that does `INSERT INTO roles (name) VALUES ('admin')`.

**Correct:** Keeping role/permission/mapping inserts in a separate seed script.

**Why:** Roles and permissions may change independently of the schema. You might want to add a new role without creating a structural migration. And seed data needs to be re-runnable (idempotent), while migrations run exactly once.

### Mistake 4: Editing an old migration after it has been applied

**Wrong:** "Migration 001 has a typo in a column name. Let me fix it in migration 001."

**Correct:** Create migration 002 that renames the column.

**Why:** If migration 001 has already been applied on your database, the tool will not re-run it. Your "fix" will never take effect. Worse, if someone else applies the migrations from scratch, they get the "fixed" version, creating inconsistency between databases.

### Mistake 5: Not testing the app after running migrations

A migration is only successful if:

1. ✅ The SQL runs without errors
2. ✅ The resulting schema is correct
3. ✅ **The app still works on that schema**

After implementing migrations, always run your existing test suite:

```bash
pnpm run test:v2
```

If the tests pass, your migrations are producing a schema that matches what the app expects.

---

## 11. What To Update After Adding Migrations

Once migrations are working, several project files need updates:

### Documentation updates

| File | What to update |
|---|---|
| [operations.md](file:///home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/docs/operations.md) | Replace `pnpm run dbprep` in the development workflow with `migrate:up` + `db:seed` |
| [README.md](file:///home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/README.md) | Update setup instructions and the scripts list |
| `docs/testing.md` | Note that tests still use destructive reset, not migrations |

### Code updates

| File | What changes |
|---|---|
| [package.json](file:///home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/package.json) | Add migration scripts, add seed script |
| `.env.example` | Add `DATABASE_URL` example |
| `src/config/db.seed.ts` | New file — standalone seed script |
| `db.setup.ts` | No changes yet — tests still depend on it |

---

## 12. Quick Reference Summary

### What are migrations?

Versioned, ordered files that describe individual changes to your database schema. Like Git commits for your database.

### Why does this project need them?

Because `pnpm run dbprep` destroys all data every time you need to change the schema. Migrations let you evolve the schema while keeping users, roles, sessions, and audit logs intact.

### What tool are we using?

`node-pg-migrate` — because it works with raw `pg` and SQL, matching the existing project style.

### What is the new workflow?

```bash
# First time setup (or after pulling new migrations)
pnpm run migrate:up    # Build/update schema from migration history
pnpm run db:seed       # Insert reference RBAC data

# Making a schema change
pnpm run migrate:create -- descriptive-name   # Create new migration file
# Edit the file with your SQL
pnpm run migrate:up                            # Apply it

# Running tests (unchanged)
pnpm run test:v2       # Still uses destructive reset internally
```

### What goes where?

```
Schema changes    → migrations/
Seed data         → src/config/db.seed.ts
Destructive reset → src/config/db.setup.ts (tests only)
App code          → src/ (as before)
```

### The implementation order

```
1. Install node-pg-migrate, add scripts         (Phase 1 — tooling)
2. Create baseline migration from db.setup.ts    (Phase 2 — foundation)
3. Create standalone seed script                 (Phase 3 — separation)
4. Document the new dev workflow                 (Phase 4 — workflow)
5. Keep destructive reset for tests only         (Phase 5 — coexistence)
6. Add migration-specific tests later            (Phase 6 — refinement)
```
