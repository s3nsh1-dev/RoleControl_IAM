-- Up Migration

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  fullname VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by INT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE permissions (
  id SERIAL PRIMARY KEY,
  action VARCHAR(50) NOT NULL,
  resource VARCHAR(50) NOT NULL,
  description TEXT,
  CHECK (action IN ('view', 'create', 'update', 'assign', 'revoke', 'delete', 'createOnBehalf')),
  CHECK (resource IN ('permission', 'role', 'user', 'post')),
  UNIQUE (action, resource)
);

CREATE TABLE user_roles (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  UNIQUE (user_id, role_id)
);

CREATE TABLE role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE (role_id, permission_id)
);

CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  owner_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  behalf_of INT REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT check_behalf_not_self
  CHECK (behalf_of IS NULL OR behalf_of != owner_id)
);

CREATE TABLE user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  device_info TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  actor_id INT REFERENCES users(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('view', 'create', 'update', 'assign', 'revoke', 'delete', 'createOnBehalf')),
  resource_type VARCHAR(50) NOT NULL CHECK (resource_type IN ('permission', 'role', 'user', 'post')),
  resource_id INT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_created_by
ON users(created_by);

CREATE INDEX idx_user_roles_role_id
ON user_roles(role_id);

CREATE INDEX idx_role_permissions_permission_id
ON role_permissions(permission_id);

CREATE INDEX idx_posts_owner_id
ON posts(owner_id);

CREATE INDEX idx_posts_behalf_of
ON posts(behalf_of);

CREATE INDEX idx_user_sessions_user_id
ON user_sessions(user_id);

CREATE INDEX idx_user_sessions_expires_at
ON user_sessions(expires_at);

CREATE INDEX idx_audit_logs_actor_id
ON audit_logs(actor_id);

CREATE INDEX idx_audit_logs_resource_lookup
ON audit_logs(resource_type, resource_id, created_at DESC);

-- Down Migration

DROP TABLE IF EXISTS audit_logs, user_sessions, posts, role_permissions, user_roles, permissions, roles, users CASCADE;
