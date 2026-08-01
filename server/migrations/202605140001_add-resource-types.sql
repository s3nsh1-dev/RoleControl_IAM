-- Up Migration

ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_resource_check;
ALTER TABLE permissions ADD CONSTRAINT permissions_resource_check
  CHECK (resource IN ('permission', 'role', 'user', 'post', 'audit_log', 'session', 'migration'));

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_resource_type_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_resource_type_check
  CHECK (resource_type IN ('permission', 'role', 'user', 'post', 'audit_log', 'session', 'migration'));

INSERT INTO permissions (action, resource, description) VALUES
  ('view', 'audit_log', 'View audit log entries'),
  ('view', 'session', 'View user session records'),
  ('revoke', 'session', 'Revoke a single user session'),
  ('delete', 'session', 'Revoke all sessions for a user'),
  ('view', 'migration', 'View database migration status')
ON CONFLICT (action, resource) DO NOTHING;

-- Down Migration

DELETE FROM role_permissions
WHERE permission_id IN (
  SELECT id FROM permissions
  WHERE (action, resource) IN (
    ('view', 'audit_log'),
    ('view', 'session'),
    ('revoke', 'session'),
    ('delete', 'session'),
    ('view', 'migration')
  )
);

DELETE FROM permissions
WHERE (action, resource) IN (
  ('view', 'audit_log'),
  ('view', 'session'),
  ('revoke', 'session'),
  ('delete', 'session'),
  ('view', 'migration')
);

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_resource_type_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_resource_type_check
  CHECK (resource_type IN ('permission', 'role', 'user', 'post'));

ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_resource_check;
ALTER TABLE permissions ADD CONSTRAINT permissions_resource_check
  CHECK (resource IN ('permission', 'role', 'user', 'post'));
