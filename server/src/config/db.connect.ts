import pg from "pg";
import env from "../utils/envHelper.ts";

const { Pool } = pg;

const pool = new Pool({
  host: env.DB_HOST_NAME,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
});

const testDbConnection = async () => {
  try {
    const client = await pool.connect();
    console.log("✅ Database connected successfully");
    client.release();
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    return false;
  }
};

export { pool, testDbConnection };
