# Part 1: Backend System Design & Flow (Context for the Frontend)

This document explains the backend architecture, data flow, and design choices of the RoleControl IAM API. It is crucial for understanding *how* the backend works so the frontend (and any assisting LLM) can interact with it correctly.

## 1. Core Domain Model & Entity Relationships
The backend uses a PostgreSQL database as the single source of truth. The primary entities and their relationships are:
- **Users**: The core identity. A user can have many roles.
- **Roles**: Logical groupings of permissions (e.g., `super-admin`, `admin`, `user`, `editor`).
- **Permissions**: Specific actions allowed on specific resources (e.g., `action: create`, `resource: post`).
- **User Roles & Role Permissions**: Pivot tables that resolve many-to-many relationships. The backend dynamically calculates a user's effective permissions by joining these tables.
- **Posts**: A sample resource belonging to a user (`owner_id`).
- **Sessions & Audits**: The backend tracks active refresh sessions (max 2 per user) and logs sensitive mutations (like role changes) for security audits.

## 2. Authentication Flow & Security Choices
**The Choice:** The backend uses a highly secure, HTTP-only cookie-based authentication system rather than sending JWTs in the JSON body.
- **Login Flow**: When the frontend calls `POST /api/auth/login`, the backend validates credentials and sets two signed `httpOnly` cookies: `access` and `refresh`. The frontend receives a JSON response with user details but *no tokens*.
- **Session Management**: The frontend does not need to store tokens in `localStorage` (mitigating XSS attacks). Instead, the browser automatically attaches these cookies to subsequent requests. The frontend must ensure that `credentials: 'include'` (in Fetch) or `withCredentials: true` (in Axios) is set for every request.
- **Token Refresh Flow**: The access token has a short lifespan. When it expires, the backend returns a `401 Unauthorized`. The frontend must catch this, call `POST /api/auth/refresh` to get a new access cookie, and retry the original request.
- **Logout Flow**: Calling `POST /api/auth/logout` revokes the session in the database and clears the cookies.

## 3. Authorization (RBAC) & Route Protection
**The Choice:** The backend validates permissions at the database level using a middleware pipeline, not just relying on the token payload.
- **Data Flow**: When a protected request hits the backend, it checks the access cookie, extracts the User ID, queries the database for that user's effective permissions, and blocks the request (`403 Forbidden`) if they lack the required rights.
- **Hierarchy**: The backend enforces a strict role rank (`super-admin` > `admin` > `editor` > `user`). For example, an `admin` cannot assign a `super-admin` role to someone else.
- **Frontend Implications**: The frontend receives the user's roles in the login/profile response. The frontend should use this data to conditionally hide UI elements (like a "Delete User" button) to improve UX, knowing the backend will ultimately enforce security.

## 4. API Standardization & Rate Limiting
**The Choice:** A unified contract layer and Redis-backed rate limiting.
- **Standardized Envelopes**: All successful responses are wrapped in `{ success: true, message: string, data: object, timestamp: string }`. All errors are wrapped in `{ success: false, status: string, message: string, details: array, trace: string }`.
- **Rate Limiting**: Auth routes and global APIs are protected by sliding-window rate limiters. If the frontend spams an endpoint, it will receive a `429 Too Many Requests`.
