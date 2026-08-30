import { z } from "zod";

// Roles table schema
// id          serial pk
// name        varchar
// description varchar
const rolesModelSchema = z.object({
  id: z
    .number()
    .int()
    .positive()
    .describe("Role Unique ID (numeric primary key)."),
  name: z.string().trim().min(3).describe("Role name (e.g. admin, editor)."),
  description: z
    .string()
    .trim()
    .optional()
    .describe("Human‑readable description of the role."),
});

export { rolesModelSchema };

export type RoleSchemaType = z.infer<typeof rolesModelSchema>;
