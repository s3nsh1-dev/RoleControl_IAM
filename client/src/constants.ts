import {
  Database,
  FileText,
  Gauge,
  KeyRound,
  Layers3,
  MonitorSmartphone,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CapabilityKey } from "./api/types";

export const DEFAULT_PAGE_SIZE = 20;

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  capability?: CapabilityKey;
  children?: NavItem[];
};

export const queryKeys = {
  authMe: ["auth", "me"] as const,
  users: (page = 1, pageSize = DEFAULT_PAGE_SIZE) =>
    ["users", { page, pageSize }] as const,
  roles: (page = 1, pageSize = DEFAULT_PAGE_SIZE) =>
    ["roles", { page, pageSize }] as const,
  permissions: (page = 1, pageSize = DEFAULT_PAGE_SIZE) =>
    ["permissions", { page, pageSize }] as const,
  rolePermissions: (page = 1, pageSize = DEFAULT_PAGE_SIZE) =>
    ["role-permissions", { page, pageSize }] as const,
  posts: (page = 1, pageSize = DEFAULT_PAGE_SIZE) =>
    ["posts", { page, pageSize }] as const,
  auditLogs: (page = 1, pageSize = DEFAULT_PAGE_SIZE) =>
    ["audit-logs", { page, pageSize }] as const,
  migrations: (page = 1, pageSize = DEFAULT_PAGE_SIZE) =>
    ["migrations", { page, pageSize }] as const,
  sessions: (page = 1, pageSize = DEFAULT_PAGE_SIZE) =>
    ["sessions", { page, pageSize }] as const,
  userSessions: (userId: number, page = 1, pageSize = DEFAULT_PAGE_SIZE) =>
    ["user-sessions", userId, { page, pageSize }] as const,
} as const;

export const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/users", label: "Users", icon: Users },
  { to: "/roles", label: "Roles", icon: ShieldCheck },
  { to: "/permissions", label: "Permissions", icon: KeyRound },
  { to: "/role-permissions", label: "Role permissions", icon: Layers3 },
  { to: "/posts", label: "Posts", icon: FileText },
  { to: "/logs", label: "Logs", icon: ScrollText, capability: "auditLogs.view" },
  {
    to: "/migrations",
    label: "Migrations",
    icon: Database,
    capability: "migrations.view",
  },
  {
    to: "/sessions",
    label: "Sessions",
    icon: MonitorSmartphone,
    children: [
      {
        to: "/sessions/all",
        label: "All sessions",
        icon: MonitorSmartphone,
        capability: "sessions.view",
      },
      {
        to: "/sessions/user",
        label: "User sessions",
        icon: MonitorSmartphone,
        capability: "sessions.view",
      },
      {
        to: "/sessions/revoke",
        label: "Revoke",
        icon: MonitorSmartphone,
        capability: "sessions.revoke",
      },
      {
        to: "/sessions/revoke-all",
        label: "Revoke all",
        icon: MonitorSmartphone,
        capability: "sessions.delete",
      },
    ],
  },
];
