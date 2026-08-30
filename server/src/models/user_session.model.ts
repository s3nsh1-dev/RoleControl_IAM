import { z } from "zod";

// User_Sessions table schema
// id                  serial pk
// user_id             int (fk -> users.id)
// refresh_token_hash  varchar
// expires_at          timestamptz
// revoked_at          timestamptz null
// device_info         varchar null
// created_at          timestamptz
const userSessionModelSchema = z.object({
  id: z
    .number()
    .int()
    .positive()
    .describe("User session unique ID (numeric primary key)."),
  user_id: z
    .number()
    .int()
    .positive()
    .describe("Foreign key referencing users.id."),
  refresh_token_hash: z
    .string()
    .trim()
    .min(32)
    .describe("Hashed refresh token stored for session validation."),
  expires_at: z.coerce
    .date()
    .describe("Time when the refresh session expires."),
  revoked_at: z.coerce
    .date()
    .nullable()
    .optional()
    .describe("Time when the session was revoked, if applicable."),
  device_info: z
    .string()
    .trim()
    .min(1)
    .nullable()
    .optional()
    .describe("Optional device or client description for the session."),
  created_at: z.coerce
    .date()
    .default(() => new Date())
    .describe("Session creation timestamp."),
});

const userSessionCreateSchema = userSessionModelSchema.omit({
  id: true,
});

export { userSessionCreateSchema, userSessionModelSchema };

export type UserSessionSchemaType = z.infer<typeof userSessionModelSchema>;
