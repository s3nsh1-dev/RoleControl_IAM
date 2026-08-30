import { z } from "zod";

// User_Roles join table schema
// id       serial pk
// user_id  int (fk -> users.id)
// role_id  int (fk -> roles.id)
const user_rolesModelSchema = z.object({
  id: z
    .number()
    .int()
    .positive()
    .describe("User_Role Unique ID (numeric primary key)."),
  user_id: z
    .number()
    .int()
    .positive()
    .describe("Foreign key referencing users.id."),
  role_id: z
    .number()
    .int()
    .positive()
    .describe("Foreign key referencing roles.id."),
});

export { user_rolesModelSchema };

export type User_RolesSchemaType = z.infer<typeof user_rolesModelSchema>;
