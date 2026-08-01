const JWT_EXPIRES_TIMELINE = [
  "10m",
  "20m",
  "30m",
  "40m",
  "50m",
  "60m",
  "70m",
  "80m",
  "90m",
  "100m",
  "110m",
  "120m",
  "1d",
  "2d",
  "3d",
  "4d",
  "5d",
  "6d",
  "7d",
  "8d",
  "9d",
  "10d",
  "11d",
  "12d",
  "13d",
  "14d",
  "15d",
] as const;

const httpOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
} as const;

const ROLES_LIST = ["super-admin", "admin", "user", "editor"] as const;
const ACTIONS_LIST = [
  "view",
  "create",
  "update",
  "assign",
  "revoke",
  "delete",
  "createOnBehalf",
] as const;
const RESOURCES_LIST = ["permission", "role", "user", "post", "audit_log", "session", "migration"] as const;

export {
  JWT_EXPIRES_TIMELINE,
  httpOptions,
  ROLES_LIST,
  ACTIONS_LIST,
  RESOURCES_LIST,
};
