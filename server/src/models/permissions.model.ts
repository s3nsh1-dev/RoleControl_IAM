import { z } from "zod";
import { ACTIONS_LIST, RESOURCES_LIST } from "@/others/constants.ts";
// Permissions table schema
// id          serial pk
// action      varchar
// resource    varchar
// description varchar
const permissionModelSchema = z.object({
  id: z
    .number()
    .int()
    .positive()
    .describe("Permission Unique ID (numeric primary key)."),
  action: z
    .enum(ACTIONS_LIST)
    .describe(
      "Action this permission allows (e.g. create, view, update, delete).",
    ),
  resource: z
    .enum(RESOURCES_LIST)
    .describe("Resource the action applies to (e.g. post, user, role)."),
  description: z
    .string()
    .trim()
    .optional()
    .describe("Human‑readable description of the permission."),
});

const permissionCreateBodySchema = permissionModelSchema.omit({
  id: true,
});

export { permissionModelSchema, permissionCreateBodySchema };

export type PermissionSchemaType = z.infer<typeof permissionModelSchema>;
