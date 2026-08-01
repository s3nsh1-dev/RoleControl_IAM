To ensure the frontend engineer (or an LLM assisting them) implements the system perfectly without missing the nuances of your backend, you should provide them with a curated set of files.

These files act as the ultimate source of truth for both the **API contracts** and the **architectural rules**.

Here are the specific files you need to make the frontend aware of, prioritized by importance:

### 1. The Machine-Readable API Contract (CRITICAL)

- **`openapi/openapi.json`**
  - **Why:** This is the absolute most important file. It contains the exact data shapes, endpoint URLs, required parameters, and the standardized success/error response envelopes (`{ success, message, data, timestamp }`). The frontend should use this file to auto-generate their TypeScript types (e.g., using `openapi-typescript`) rather than guessing.

### 2. The Architectural Guidelines & Playbooks

- **`learning_readme/FRONTEND_PLAN.md`**
  - **Why:** The document we just created. It acts as the blueprint for the frontend. It explains the tricky parts: the HTTP-only cookie flow, the `401 Unauthorized` Axios interceptor logic, handling `429 Too Many Requests`, and how to handle optimistic UI updates safely.
- **`learning_readme/01_BACKEND_FLOW_FOR_FRONTEND.md`** & **`learning_readme/02_FRONTEND_PRODUCTION_DESIGN.md`**
  - **Why:** These provide the background rationale on _why_ the frontend must behave a certain way (e.g., why tokens aren't in `localStorage`, why roles dictate UI visibility but not actual security).

### 3. Backend Enums & Constants

- **`src/others/constants.ts`**
  - **Why:** This file contains the exact literal arrays for `ROLES_LIST` (e.g., `"super-admin", "admin", "user", "editor"`), `ACTIONS_LIST`, and `RESOURCES_LIST`. If the frontend needs to hardcode permission guard checks (like `<Protect requiredRole="admin">`), this file tells them exactly what strings the backend uses.

### 4. High-Level Documentation (Optional but Helpful)

- **`docs/api.md`**
  - **Why:** A human-readable summary of the API endpoints, pointing out details like the base path `/api` and that `userId` or `roleName` are used as URL parameters.
- **`docs/architecture.md`**
  - **Why:** Provides context on the session limits (max 2 sessions per user) and audit logging, ensuring the frontend developer understands the consequences of certain API calls.

### Summary Strategy for an LLM

If you are passing this context to another LLM to write the frontend code, the best prompt strategy is:

1. Provide the **`FRONTEND_PLAN.md`** and tell it: _"Read this to understand the architecture and rules."_
2. Provide the **`openapi/openapi.json`** and tell it: _"Read this to understand the exact endpoints and data schemas."_
3. Ask it to generate the **Axios Interceptor** and **TypeScript types** first before building any UI components.

=======================================

Viewed FRONTEND_PLAN.md:1-21

Here is a breakdown of why these three files exist, what they represent, and exactly when you should use them.

### Why do these 3 files exist?

They represent the **evolution of your planning process**. Your `learning_readme` directory acts like a journal of your architectural decisions.

1. **`29_BACKEND_FLOW_FOR_FRONTEND.md` (The "What is the Backend doing?" file)**
   - **What it is:** This was an early analysis document. It focused purely on extracting the backend's behavior (cookie auth, database-driven RBAC, standard JSON envelopes) so you could understand what a frontend _would have to deal with_.
2. **`30_FRONTEND_PRODUCTION_DESIGN.md` (The "How should the Frontend be built?" file)**
   - **What it is:** This was your initial brainstorm for the frontend tech stack. It proposed Next.js/Vite, React Query, Zustand, and the critical Axios Interceptor engine.
3. **`FRONTEND_PLAN.md` (The Consolidated Master Guide)**
   - **What it is:** This is the **final, polished blueprint** I just created for you. It takes all the raw ideas from `29` and `30`, fixes any gaps, and adds critical missing context from your `docs/` folder and `openapi.json` (like the strict 2-session limit, the `/api/docs` Swagger UI, and audit logging rules).

---

### What and When to provide these docs?

**To a Frontend Engineer (or an LLM generating the code):**
You should **ONLY provide `FRONTEND_PLAN.md`** and `openapi/openapi.json`.

You **do not** need to provide `29` and `30` to the engineer or LLM. Giving them all three files will cause confusion and redundant reading, as `FRONTEND_PLAN.md` already contains all the information from `29` and `30`, but organized much better.

**The ideal prompt for an LLM starting the frontend work:**

> "I am building the frontend for the Node.js RoleControl IAM backend.
>
> 1. Read `FRONTEND_PLAN.md` to understand the architecture, the Axios interceptor rules, and the UX guidelines.
> 2. Read `openapi/openapi.json` to understand the exact endpoints, request bodies, and response envelopes.
>
> Please start by generating the Axios instance with the interceptor logic and the OpenAPI TypeScript definitions."

**So, what do you do with 29 and 30?**
Keep them in your repository as a historical record of your learning and planning phase (just like the other numbered files in your `learning_readme` folder). They show _how_ you arrived at the final `FRONTEND_PLAN.md`.
