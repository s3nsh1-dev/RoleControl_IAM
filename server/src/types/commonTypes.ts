import {
  ROLES_LIST,
  ACTIONS_LIST,
  RESOURCES_LIST,
} from "../others/constants.ts";
import type { PoolClient, Pool } from "pg";

type JwtBaseClaims = {
  iat: number;
  exp: number;
  iss: "s3nsh1-dev";
  aud: "RBAC-users";
};
type USER_JWT_PAYLOAD_TYPE = {
  uId: number;
  email: string;
} & JwtBaseClaims;
type REFRESH_JWT_PAYLOAD_TYPE = {
  uId: number;
  sId: number;
  type: "refresh";
} & JwtBaseClaims;

type QueryableDb = Pick<PoolClient | Pool, "query">;
type AuditPayloadType = Record<string, unknown> | null;
type AuditDBMutationInput = {
  db?: QueryableDb;
  actorId: number | null;
  actionType: ACTIONS_TYPES;
  resourceType: RESOURCES_TYPES;
  resourceId: number;
  oldValues?: AuditPayloadType;
  newValues?: AuditPayloadType;
  metadata?: AuditPayloadType;
};

type ROLES_TYPES = (typeof ROLES_LIST)[number];
type ACTIONS_TYPES = (typeof ACTIONS_LIST)[number];
type RESOURCES_TYPES = (typeof RESOURCES_LIST)[number];

export {
  USER_JWT_PAYLOAD_TYPE,
  REFRESH_JWT_PAYLOAD_TYPE,
  ROLES_TYPES,
  ACTIONS_TYPES,
  RESOURCES_TYPES,
  QueryableDb,
  AuditDBMutationInput,
};
