import dotenv from "dotenv";
import { z } from "zod";
import { JWT_EXPIRES_TIMELINE } from "../others/constants.ts";

dotenv.config();

const envSchema = z.object({
  // z.coerce.number() converts the string from process.env → number before validating
  PORT: z.coerce.number().default(8000).describe("Port number"),
  HOST: z.string().default("0.0.0.0").describe("Host name"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development")
    .describe("Node environment"),
  SHUTDOWN_GRACE_MS: z.coerce
    .number()
    .default(10000)
    .describe("Shutdown grace time in milliseconds"),
  DB_SERVER_GROUP_NAME: z
    .string()
    .default("placeholder")
    .describe("Database server group name"),
  DB_SERVER_NAME: z
    .string()
    .default("placeholder")
    .describe("Database server name"),
  DB_NAME: z.string().default("placeholder").describe("Database name"),
  DB_PORT: z.coerce.number().default(5432).describe("Database port"),
  DB_HOST_NAME: z
    .string()
    .default("placeholder")
    .describe("Database host name"),
  DB_USER: z.string().default("postgres").describe("Database user"),
  DB_PASSWORD: z.string().default("password").describe("Database password"),
  DATABASE_URL: z
    .string()
    .optional()
    .describe("Optional PostgreSQL connection string for migration tooling"),
  SALT_ROUNDS: z.coerce
    .number()
    .default(10)
    .describe("Salt Rounds will be used to hash all passwords"),
  JWT_SECRET: z.string().min(1).default("placeholder").describe("JWT secret"),
  ACCESS_TOKEN_EXPIRES_IN: z
    .enum(JWT_EXPIRES_TIMELINE)
    .default("20m")
    .describe("ACCESS JWT expires in"),
  REFRESH_TOKEN_EXPIRES_IN: z
    .enum(JWT_EXPIRES_TIMELINE)
    .default("7d")
    .describe("REFRESH JWT expires in"),
  REDIS_HOST: z.string().default("127.0.0.1").describe("Redis host address"),
  REDIS_PORT: z.coerce.number().default(6379).describe("Redis port number"),
  REDIS_URL: z
    .string()
    .optional()
    .describe("Optional Redis connection string (overrides host/port)"),
  TRUST_PROXY: z
    .string()
    .default("false")
    .describe("Express trust proxy setting"),
  RATE_LIMIT_LOGIN_IP_LIMIT: z.coerce
    .number()
    .int()
    .positive()
    .default(20)
    .describe("Max login requests per IP in the rolling window"),
  RATE_LIMIT_LOGIN_IP_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000)
    .describe("Login IP rolling window in milliseconds"),
  RATE_LIMIT_LOGIN_FAIL_LIMIT: z.coerce
    .number()
    .int()
    .positive()
    .default(5)
    .describe("Max failed login attempts per email+IP in the rolling window"),
  RATE_LIMIT_LOGIN_FAIL_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000)
    .describe("Failed login rolling window in milliseconds"),
  RATE_LIMIT_REFRESH_IP_LIMIT: z.coerce
    .number()
    .int()
    .positive()
    .default(30)
    .describe("Max refresh requests per IP in the rolling window"),
  RATE_LIMIT_REFRESH_IP_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000)
    .describe("Refresh IP rolling window in milliseconds"),
  RATE_LIMIT_REFRESH_SESSION_LIMIT: z.coerce
    .number()
    .int()
    .positive()
    .default(10)
    .describe("Max refresh requests per session in the rolling window"),
  RATE_LIMIT_REFRESH_SESSION_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000)
    .describe("Refresh session rolling window in milliseconds"),
  RATE_LIMIT_GLOBAL_IP_LIMIT: z.coerce
    .number()
    .int()
    .positive()
    .default(100)
    .describe("Max global API requests per IP in the rolling window"),
  RATE_LIMIT_GLOBAL_IP_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 1000)
    .describe("Global API rolling window in milliseconds"),
  RATE_LIMIT_USER_LIMIT: z.coerce
    .number()
    .int()
    .positive()
    .default(60)
    .describe("Max requests per authenticated user in the rolling window"),
  RATE_LIMIT_USER_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 1000)
    .describe("User rate limit rolling window in milliseconds"),
});

// Pass process.env directly — Zod picks only the keys defined in the schema
const env = envSchema.parse(process.env);

export default env;
