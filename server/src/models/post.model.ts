import { z } from "zod";

const postModelSchema = z.object({
  id: z
    .number()
    .int()
    .positive()
    .describe("Post Unique ID (numeric primary key)."),
  title: z
    .string()
    .trim()
    .describe("Title for the Post")
    .min(3, "Please enter more than 3 characters as title")
    .max(255, "Title must be 255 characters or fewer."),
  content: z.string().trim().nullable().optional().describe("Content for post"),
  owner_id: z
    .number()
    .int()
    .positive()
    .describe("Foreign key referencing user.id."),
  created_at: z
    .date()
    .default(() => new Date())
    .describe("Post creation timestamp."),
  behalf_of: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .describe(
      "Foreign key referencing user.id. Set only when a super-admin creates a post on behalf of another user.",
    ),
});

const postWriteBodySchema = postModelSchema.pick({
  title: true,
  content: true,
});

export { postModelSchema, postWriteBodySchema };

export type PostSchemaType = z.infer<typeof postModelSchema>;
