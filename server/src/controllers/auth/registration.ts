import { asyncHandler } from "../../utils/asyncHandler.ts";
import { AppError } from "../../utils/AppError.ts";
import { AppResponse } from "../../utils/AppResponse.ts";
import { pool } from "../../config/db.connect.ts";
import { generateHashString } from "../../utils/encryptStrings.ts";
import { auditDBMutation } from "@/utils/helper.ts";
import { AuthRegisterRequestSchema } from "@/contracts/api.contracts.ts";
import { toUserSummary } from "@/contracts/api.mappers.ts";

const authRegistration = asyncHandler(async (req, res) => {
  // Step 1: Take User input
  const {
    fullname,
    email,
    password: unencryptedPassword,
  } = AuthRegisterRequestSchema.parse(req.body);

  // Step 3: Check if user already exists
  const existingUser = await pool.query(
    "SELECT 1 FROM users WHERE email = $1",
    [email],
  );
  if ((existingUser.rowCount ?? 0) > 0) {
    throw AppError.badRequest("User already exists with this email");
  }

  const client = await pool.connect();

  try {
    // Lock the database operations into a single chained transaction
    await client.query("BEGIN");

    // Step 4: Lock the super-admin role row so only one bootstrap registration
    // can proceed at a time across concurrent requests.
    const superAdminRole = await client.query(
      "SELECT id FROM roles WHERE name = $1 FOR UPDATE",
      ["super-admin"],
    );
    const defaultUserRole = await client.query(
      "SELECT id FROM roles WHERE name = $1",
      ["user"],
    );
    if (
      (superAdminRole.rowCount ?? 0) !== 1 ||
      (defaultUserRole.rowCount ?? 0) !== 1
    ) {
      throw AppError.notFound(
        "Default 'user' or 'super-admin' role not found in database",
      );
    }

    const godExists = await client.query(
      `SELECT 1
       FROM user_roles
       WHERE role_id = $1
       LIMIT 1`,
      [superAdminRole.rows[0].id],
    );
    if ((godExists.rowCount ?? 0) > 0) {
      throw AppError.forbidden(
        "Registration is locked. App already initialized with a super-admin.",
      );
    }

    // Step 5: Hash the password
    const hashedPassword = await generateHashString(unencryptedPassword);

    // Step 6: Insert user
    const nextUserIdResult = await client.query<{
      id: number;
    }>("SELECT nextval(pg_get_serial_sequence('users', 'id')) AS id");
    const newUserId = nextUserIdResult.rows[0]?.id;
    if (!newUserId) {
      throw AppError.badRequest("Failed to reserve a user id for registration");
    }

    const newUserResult = await client.query(
      `INSERT INTO users (id, fullname, email, password, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $1)
       RETURNING *`,
      [newUserId, fullname, email, hashedPassword, true],
    );
    const newUser = newUserResult.rows[0];
    const { password: _password, ...safeNewUser } = newUser;

    // Step 7: Assign super-admin and default user roles
    const assignSuperAdminRole = await client.query(
      "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) RETURNING *",
      [newUser.id, superAdminRole.rows[0].id],
    );
    const assignUserRole = await client.query(
      "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) RETURNING *",
      [newUser.id, defaultUserRole.rows[0].id],
    );

    await auditDBMutation({
      actorId: newUser.id,
      actionType: "assign",
      resourceType: "role",
      resourceId: assignSuperAdminRole.rows[0].id,
      oldValues: null,
      newValues: assignSuperAdminRole.rows[0],
      metadata: null,
      db: client,
    });
    await auditDBMutation({
      actorId: newUser.id,
      actionType: "assign",
      resourceType: "role",
      resourceId: assignUserRole.rows[0].id,
      oldValues: null,
      newValues: assignUserRole.rows[0],
      metadata: null,
      db: client,
    });
    await auditDBMutation({
      actorId: newUser.id,
      actionType: "create",
      resourceType: "user",
      resourceId: newUserResult.rows[0].id,
      oldValues: null,
      newValues: safeNewUser,
      metadata: null,
      db: client,
    });

    await client.query("COMMIT"); // Everything worked! Save both the user and the role permanently.

    // Step 8: Send Response
    new AppResponse(201, "Super-Admin registered successfully. Please login.", {
      user: toUserSummary(safeNewUser),
      roles: ["super-admin", "user"],
    }).send(res);
  } catch (error) {
    await client.query("ROLLBACK"); // Something broke! Undo everything so we don't end up with ghost data.
    if (!(error instanceof AppError)) {
      console.error("Registration Transaction Error:", error);
    }
    throw error;
  } finally {
    client.release(); // CRITICAL: Return the dedicated client back to the connection pool
  }
});

export { authRegistration };
