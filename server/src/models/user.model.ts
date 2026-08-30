import { z } from "zod";

// Users table schema
// id          serial pk
// fullname    varchar
// email       varchar
// password    varchar
// is_active   boolean
// created_at  timestamp
// created_by  int (fk -> users.id)

const userModelSchema = z.object({
  id: z
    .number()
    .int()
    .positive()
    .describe("User Unique ID (numeric primary key)."),
  fullname: z
    .string()
    .trim()
    .min(3, "Full name must be at least 3 characters long.")
    .max(150, "Full name must be 150 characters or fewer.")
    .describe("Full name of the user."),
  email: z.string().trim().email().describe("User email address."),
  password: z.string().nonempty().min(4).describe("User password."),
  is_active: z
    .boolean()
    .default(true)
    .describe("Whether the user account is active."),
  created_at: z.coerce.date().describe("Time of user registration."),
  created_by: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .describe("Foreign key referencing the actor user who created this user."),
});

const userLoginBodySchema = userModelSchema.pick({
  email: true,
  password: true,
});

const userCreateBodySchema = userModelSchema.pick({
  fullname: true,
  email: true,
  password: true,
});

export { userCreateBodySchema, userLoginBodySchema, userModelSchema };

export type UserSchemaType = z.infer<typeof userModelSchema>;
