import { z } from 'zod'
import { permissionActions, permissionResources, roleNames } from '../api/types'

const optionalText = (max: number, message: string) =>
  z.string().trim().max(max, message).optional()

const optionalPositiveInteger = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || (/^\d+$/.test(value) && Number(value) > 0),
    'User ID must be a positive whole number',
  )

const requiredPositiveInteger = optionalPositiveInteger.refine(
  (value) => value !== '',
  'User ID is required',
)

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
})

export const registerSchema = z.object({
  fullname: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be 100 characters or less'),
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const createUserSchema = registerSchema.extend({
  roleName: z.enum(roleNames),
})

export const createRoleSchema = z.object({
  name: z.enum(roleNames),
  description: optionalText(500, 'Description must be 500 characters or less'),
})

export const createPermissionSchema = z.object({
  action: z.enum(permissionActions),
  resource: z.enum(permissionResources),
  description: optionalText(500, 'Description must be 500 characters or less'),
})

export const createPostSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must be 200 characters or less'),
  content: z.string().trim().max(10000, 'Content must be 10000 characters or less'),
  behalfUserId: optionalPositiveInteger,
})

export const assignRoleSchema = z.object({
  userId: requiredPositiveInteger,
  roleName: z.enum(roleNames),
})

export const rolePermissionSchema = z.object({
  roleName: z.enum(roleNames),
  action: z.enum(permissionActions),
  resource: z.enum(permissionResources),
})

export const sessionIdSchema = z.object({
  sessionId: requiredPositiveInteger,
})

export const userIdSchema = z.object({
  userId: requiredPositiveInteger,
})

export const editUserSchema = z.object({
  fullname: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be 100 characters or less'),
})

export const editRoleSchema = z.object({
  description: z.string().trim().max(500, 'Description must be 500 characters or less'),
})

export const editPostSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must be 200 characters or less'),
  content: z.string().trim().max(10000, 'Content must be 10000 characters or less'),
})

export type LoginFormValues = z.infer<typeof loginSchema>
export type RegisterFormValues = z.infer<typeof registerSchema>
export type CreateUserFormValues = z.infer<typeof createUserSchema>
export type CreateRoleFormValues = z.infer<typeof createRoleSchema>
export type CreatePermissionFormValues = z.infer<typeof createPermissionSchema>
export type CreatePostFormValues = z.infer<typeof createPostSchema>
export type AssignRoleFormValues = z.infer<typeof assignRoleSchema>
export type RolePermissionFormValues = z.infer<typeof rolePermissionSchema>
export type SessionIdFormValues = z.infer<typeof sessionIdSchema>
export type UserIdFormValues = z.infer<typeof userIdSchema>
export type EditUserFormValues = z.infer<typeof editUserSchema>
export type EditRoleFormValues = z.infer<typeof editRoleSchema>
export type EditPostFormValues = z.infer<typeof editPostSchema>
