import { describe, expect, it } from 'vitest'
import {
  assignRoleSchema,
  createPermissionSchema,
  createPostSchema,
  createRoleSchema,
  createUserSchema,
  editPostSchema,
  editRoleSchema,
  editUserSchema,
  loginSchema,
  registerSchema,
  rolePermissionSchema,
  sessionIdSchema,
  userIdSchema,
} from '../schemas'

describe('auth schemas', () => {
  it('validates login credentials and trims email', () => {
    const result = loginSchema.safeParse({
      email: '  admin@example.com  ',
      password: 'pass',
    })

    expect(result.success).toBe(true)
    expect(result.data?.email).toBe('admin@example.com')
    expect(loginSchema.safeParse({ email: 'bad', password: 'pass' }).success).toBe(
      false,
    )
    expect(
      loginSchema.safeParse({ email: 'admin@example.com', password: 'abc' }).success,
    ).toBe(false)
  })

  it('validates register and create-user inputs', () => {
    expect(
      registerSchema.safeParse({
        fullname: 'Test Admin',
        email: 'admin@example.com',
        password: 'password123',
      }).success,
    ).toBe(true)
    expect(
      registerSchema.safeParse({
        fullname: 'A',
        email: 'admin@example.com',
        password: 'password123',
      }).success,
    ).toBe(false)
    expect(
      registerSchema.safeParse({
        fullname: 'A'.repeat(101),
        email: 'admin@example.com',
        password: 'password123',
      }).success,
    ).toBe(false)
    expect(
      registerSchema.safeParse({
        fullname: 'Test Admin',
        email: 'admin@example.com',
        password: '1234567',
      }).success,
    ).toBe(false)
    expect(
      createUserSchema.safeParse({
        fullname: 'Test Admin',
        email: 'admin@example.com',
        password: 'password123',
        roleName: 'editor',
      }).success,
    ).toBe(true)
    expect(
      createUserSchema.safeParse({
        fullname: 'Test Admin',
        email: 'admin@example.com',
        password: 'password123',
        roleName: 'owner',
      }).success,
    ).toBe(false)
  })
})

describe('role and permission schemas', () => {
  it('validates role and permission enum values', () => {
    expect(createRoleSchema.safeParse({ name: 'admin', description: '' }).success).toBe(
      true,
    )
    expect(createRoleSchema.safeParse({ name: 'owner' }).success).toBe(false)
    expect(
      createRoleSchema.safeParse({
        name: 'admin',
        description: 'a'.repeat(501),
      }).success,
    ).toBe(false)
    expect(
      createPermissionSchema.safeParse({
        action: 'view',
        resource: 'post',
        description: '',
      }).success,
    ).toBe(true)
    expect(
      createPermissionSchema.safeParse({ action: 'publish', resource: 'post' }).success,
    ).toBe(false)
    expect(
      rolePermissionSchema.safeParse({
        roleName: 'editor',
        action: 'update',
        resource: 'post',
      }).success,
    ).toBe(true)
  })
})

describe('post schemas', () => {
  it('validates create and edit post inputs', () => {
    expect(
      createPostSchema.safeParse({
        title: 'New post',
        content: '',
        behalfUserId: '',
      }).success,
    ).toBe(true)
    expect(
      createPostSchema.safeParse({
        title: 'No',
        content: '',
        behalfUserId: '',
      }).success,
    ).toBe(false)
    expect(
      createPostSchema.safeParse({
        title: 'A'.repeat(201),
        content: '',
        behalfUserId: '',
      }).success,
    ).toBe(false)
    expect(
      createPostSchema.safeParse({
        title: 'New post',
        content: 'x',
        behalfUserId: '0',
      }).success,
    ).toBe(false)
    expect(
      createPostSchema.safeParse({
        title: 'New post',
        content: 'x',
        behalfUserId: '12',
      }).success,
    ).toBe(true)
    expect(
      editPostSchema.safeParse({
        title: 'Edited post',
        content: 'Updated content',
      }).success,
    ).toBe(true)
  })
})

describe('id and edit schemas', () => {
  it('validates edit forms and positive id strings', () => {
    expect(editUserSchema.safeParse({ fullname: 'Updated User' }).success).toBe(true)
    expect(editUserSchema.safeParse({ fullname: 'U' }).success).toBe(false)
    expect(editRoleSchema.safeParse({ description: 'A role' }).success).toBe(true)
    expect(
      assignRoleSchema.safeParse({ userId: '1', roleName: 'admin' }).success,
    ).toBe(true)
    expect(
      assignRoleSchema.safeParse({ userId: '', roleName: 'admin' }).success,
    ).toBe(false)
    expect(sessionIdSchema.safeParse({ sessionId: '2' }).success).toBe(true)
    expect(sessionIdSchema.safeParse({ sessionId: 'abc' }).success).toBe(false)
    expect(userIdSchema.safeParse({ userId: '3' }).success).toBe(true)
    expect(userIdSchema.safeParse({ userId: '-1' }).success).toBe(false)
  })
})
