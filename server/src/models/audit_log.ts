import { z } from "zod";
import { ACTIONS_LIST, RESOURCES_LIST } from "@/others/constants.ts";

const auditSnapshotSchema = z
  .record(z.string(), z.unknown())
  .describe("JSON snapshot of a resource state before or after an action.");

const auditMetadataSchema = z
  .record(z.string(), z.unknown())
  .describe("Event-specific JSON payload for non-row-diff actions.");

const auditLogModelSchema = z.object({
  id: z
    .number()
    .int()
    .positive()
    .describe("Audit log unique ID (numeric primary key)."),
  actor_id: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .describe("Foreign key referencing the user who performed the action."),
  action_type: z
    .enum(ACTIONS_LIST)
    .describe("Action performed by the actor on the resource."),
  resource_type: z
    .enum(RESOURCES_LIST)
    .describe("Resource family affected by the action."),
  resource_id: z
    .number()
    .int()
    .positive()
    .describe("Primary key of the affected resource."),
  old_values: auditSnapshotSchema
    .nullable()
    .optional()
    .describe("Resource snapshot before the change."),
  new_values: auditSnapshotSchema
    .nullable()
    .optional()
    .describe("Resource snapshot after the change."),
  metadata: auditMetadataSchema
    .nullable()
    .optional()
    .describe("Extra event data for actions such as assign or revoke."),
  created_at: z.coerce
    .date()
    .default(() => new Date())
    .describe("Time when the audit event was recorded."),
});

const auditLogCreateSchema = auditLogModelSchema.omit({
  id: true,
});

export {
  auditLogCreateSchema,
  auditLogModelSchema,
  auditMetadataSchema,
  auditSnapshotSchema,
};

export type AuditLogSchemaType = z.infer<typeof auditLogModelSchema>;

// Audit_Logs table schema
// id            serial pk
// actor_id      int (fk -> users.id)
// action_type   varchar
// resource_type varchar
// resource_id   int
// old_values    jsonb null
// new_values    jsonb null
// metadata      jsonb null
// created_at    timestamptz
