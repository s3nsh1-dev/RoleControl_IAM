# Understanding API Mappers (`src/contracts/api.mappers.ts`)

## What are API Mappers?

In our application architecture, `api.mappers.ts` is responsible for **data transformation and sanitization**. Its primary job is to take raw data structures (usually database records returned from PostgreSQL) and convert them into clean, strongly-typed JavaScript objects that match the structures defined in our API contracts.

## Why Do We Need Them?

When querying a database using raw SQL (like with `pg` or `pool.query`), the resulting rows are untyped `Record<string, any>` objects. 

This presents a few challenges:
1. **Type Inconsistencies:** Some databases or drivers return numeric types (like `BIGINT`) as strings to prevent JavaScript precision loss.
2. **Missing or Null Fields:** Sometimes outer joins result in `null` fields that we need to handle gracefully.
3. **Internal Data Leakage:** A database row often contains sensitive columns (like `password` or internal DB `id` fields) that should never be sent directly to the client.

Mappers act as a boundary layer between the Database/Repository tier and the API Response tier. They ensure that what we send out is strictly what we promised in `api.contracts.ts`.

## How It Works

A typical mapper function takes a raw database record and returns a cleanly structured object. It heavily utilizes utilities from `src/utils/validation.util.ts` (like `parsePositiveInt` or `parseEmail`) to forcefully coerce and validate the raw data.

*Example from `src/contracts/api.mappers.ts`:*
```typescript
const toUserSummary = (user: Record<string, unknown>) => ({
  // Forces the ID to be a positive integer, even if the DB returned a string
  id: parsePositiveInt(user["id"], "user.id"),
  
  // Ensures fullname is a string
  fullname: String(user["fullname"] ?? ""),
  
  // Validates and extracts the email
  email: parseEmail(user["email"], "user.email"),
  
  // Converts to boolean
  is_active: Boolean(user["is_active"]),
  
  // Formats dates to standard ISO strings
  created_at: toIsoTimestamp(user["created_at"]),
  
  created_by: user["created_by"] == null ? null : parsePositiveInt(user["created_by"], "user.created_by"),
});
```

Notice that we **do not** include the `password` field or other internal columns. By manually plucking and formatting only the necessary properties, we inherently sanitize the output.

## Connection to the Rest of the Application

Mappers are typically used at the very end of a controller's execution block, right before the data is wrapped in an `AppResponse` and sent to the client.

*Example from `src/controllers/users/listUsers.ts`:*
```typescript
import { toUserSummary } from "@/contracts/api.mappers.ts";
import { sanitizeUserRecord } from "../../utils/helper.ts";

const result = await pool.query(`SELECT ... FROM users`);

// We map over the raw database rows and use `toUserSummary` 
// to format them securely for the client.
new AppResponse(200, "Users fetched successfully", {
  users: result.rows.map((user) =>
    toUserSummary(sanitizeUserRecord(user) as Record<string, unknown>),
  ),
}).send(res);
```

*Example from `src/controllers/auth/login.ts`:*
```typescript
import { toAuthenticatedUser } from "@/contracts/api.mappers.ts";

// `user` is the raw record from the DB, including the password hash
const user = userInfo.rows[0]; 

// ... authentication logic ...

// We use the mapper to strip out the password and send only safe data
new AppResponse(200, "User logged in successfully", {
  user: toAuthenticatedUser(user),
}).send(res);
```

In summary, `api.mappers.ts` is the crucial formatting layer that ensures the raw, unpredictable data from the database is transformed into the exact, secure, and strongly-typed objects that our API is contracted to return.
