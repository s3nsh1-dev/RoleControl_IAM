import { asyncHandler } from "../../utils/asyncHandler.ts";
import { pool } from "../../config/db.connect.ts";
import { AppResponse } from "../../utils/AppResponse.ts";
import { AppError } from "../../utils/AppError.ts";
import { generateHashString } from "../../utils/encryptStrings.ts";
import {
  auditDBMutation,
  canActorManageRole,
  checkRolePermissions,
  getHighestUserRole,
  sanitizeUserRecord,
} from "../../utils/helper.ts";
import { parsePositiveInt } from "../../utils/validation.util.ts";
import { CreateUserRequestSchema } from "@/contracts/api.contracts.ts";
import { toRole, toUserSummary } from "@/contracts/api.mappers.ts";

const createUser = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.uId) {
    throw AppError.unauthorized("User not found");
  }
  const actorId = parsePositiveInt(req.user.uId, "actorId");

  await checkRolePermissions(actorId, "create", "user");
  await checkRolePermissions(actorId, "assign", "role");

  const {
    fullname,
    email,
    password: unencryptedPassword,
    roleName,
  } = CreateUserRequestSchema.parse(req.body);

  const existingUser = await pool.query("SELECT 1 FROM users WHERE email = $1", [
    email,
  ]);
  if ((existingUser.rowCount ?? 0) > 0) {
    throw AppError.badRequest("User already exists with this email");
  }

  const hashedPassword = await generateHashString(unencryptedPassword);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const actorHighestRole = await getHighestUserRole(actorId, client);
    if (!actorHighestRole) {
      throw AppError.forbidden("Actor does not have an assigned role");
    }
    if (!canActorManageRole(actorHighestRole, roleName)) {
      throw AppError.forbidden("You cannot create a user with this role");
    }

    const newUserResult = await client.query(
      `INSERT INTO users (fullname, email, password, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [fullname, email, hashedPassword, true, actorId],
    );
    if ((newUserResult.rowCount ?? 0) !== 1) {
      throw AppError.badRequest("User not created");
    }
    const newUser = newUserResult.rows[0];
    const safeNewUser = sanitizeUserRecord(newUser);

    const roleNamesToAssign =
      roleName === "user" ? (["user"] as const) : ([roleName, "user"] as const);
    const targetRoles = await client.query(
      "SELECT id, name, description FROM roles WHERE name = ANY($1::text[])",
      [roleNamesToAssign],
    );
    if ((targetRoles.rowCount ?? 0) !== roleNamesToAssign.length) {
      throw AppError.notFound("One or more roles were not found");
    }

    const targetRole = targetRoles.rows.find((role) => role.name === roleName);
    if (!targetRole) {
      throw AppError.notFound(`Role '${roleName}' not found`);
    }

    await auditDBMutation({
      db: client,
      actorId,
      actionType: "create",
      resourceType: "user",
      resourceId: newUser.id,
      newValues: safeNewUser,
    });

    for (const nextRoleName of roleNamesToAssign) {
      const nextRole = targetRoles.rows.find((role) => role.name === nextRoleName);
      if (!nextRole) {
        throw AppError.notFound(`Role '${nextRoleName}' not found`);
      }

      const roleTableEntry = await client.query(
        "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) RETURNING *",
        [newUser.id, nextRole.id],
      );
      if ((roleTableEntry.rowCount ?? 0) !== 1) {
        throw AppError.badRequest("User role not assigned");
      }

      await auditDBMutation({
        db: client,
        actorId,
        actionType: "assign",
        resourceType: "role",
        resourceId: roleTableEntry.rows[0].id,
        newValues: roleTableEntry.rows[0],
        metadata: {
          message: `${actorId} assigned role ${nextRoleName} to user ${newUser.id}`,
        },
      });
    }

    await client.query("COMMIT");

    new AppResponse(201, "User created successfully", {
      user: toUserSummary(safeNewUser),
      role: toRole(targetRole),
    }).send(res);
    return;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export { createUser };
