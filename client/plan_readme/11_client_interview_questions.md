# Client interview questions (interviewer script)

> **10 questions only** — frontend / React scope for the RoleControl IAM client.  
> Use as a mock technical screen. Answers are **not** in this file; see [12_client_interview_answers.md](./12_client_interview_answers.md).

**Suggested order:** increasing difficulty (architecture → auth → data → production).

---

## 1. Architecture and folder boundaries

Walk me through how you organized the client. What belongs in `pages/`, `features/`, `components/`, and `api/`, and what rules do you follow for imports?

**Follow-up:** Why use barrel files (`features/users/index.ts`) instead of importing component files directly?

---

## 2. Server state: TanStack Query vs Zustand

This app uses both React Query and Zustand. What state lives where, and why did you not put everything in one place?

**Follow-up:** How are query keys defined and invalidated after a mutation?

---

## 3. Authentication and session handling

Explain the end-to-end auth flow from login through accessing a protected route. Where are tokens stored, and what happens on a 401 from a normal API call?

**Follow-up:** What does `ProtectedRoute` do when `/api/auth/me` fails vs returns 401?

---

## 4. RBAC and capabilities in the UI

How does the frontend know what the current user is allowed to do? How do you hide or show actions, and what are the security limits of that approach?

**Follow-up:** How is the sidebar built so users only see routes they can access?

---

## 5. OpenAPI and TypeScript types

How do you keep frontend types aligned with the backend API? What is your workflow when the API contract changes?

**Follow-up:** What is the role of `api/schema.ts` vs `api/types.ts`?

---

## 6. Forms and validation

Describe how you validate forms before submit. Why Zod and react-hook-form together?

**Follow-up:** Pick one form (e.g. create user) and trace validation from schema to error message on screen.

---

## 7. Loading, errors, and rate limits

How does the UI handle loading, empty lists, failed queries, and HTTP 429? Point to shared patterns vs one-off code.

**Follow-up:** What is `AsyncQueryPanel` for, and where would you *not* use it?

---

## 8. Mutation lifecycle (concrete example)

Pick the Users page (or another CRUD screen). Walk me through what happens when the user clicks “Create user” — from form submit to list refresh.

**Follow-up:** Why invalidate `queryKeys.authMe` after assigning a role to a user?

---

## 9. Recent refactor: component delegation

You split large page files into `features/*/components`. What moved out of pages, what stayed in pages, and what did you intentionally *not* change?

**Follow-up:** How would you add a new screen following the same pattern?

---

## 10. Production readiness

If this client had to ship to real users next month, what are the top three gaps you would fix first and how would you prioritize them?

**Follow-up:** How would you test the axios refresh interceptor without manual clicking?

---

## Interviewer notes (optional)

- Allow the candidate to share screen and navigate `src/`.
- For Q3 and Q8, insist on **file names**, not only concepts.
- Strong candidates admit UI RBAC is not authorization (Q4) and tests are missing (Q10).
- Timebox: ~5–6 minutes per question in a 60-minute slot, or pick 5 questions for 30 minutes.
