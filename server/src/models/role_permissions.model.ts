import { z } from "zod";

// Role_Permissions join table schema
// id            serial pk
// role_id       int (fk -> roles.id)
// permission_id int (fk -> permissions.id)
const role_permissionsModelSchema = z.object({
  id: z
    .number()
    .int()
    .positive()
    .describe("Role_Permission Unique ID (numeric primary key)."),
  role_id: z
    .number()
    .int()
    .positive()
    .describe("Foreign key referencing roles.id."),
  permission_id: z
    .number()
    .int()
    .positive()
    .describe("Foreign key referencing permissions.id."),
});

export { role_permissionsModelSchema };

export type Role_PermissionsSchemaType = z.infer<
  typeof role_permissionsModelSchema
>;
