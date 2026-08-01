# 15. Interview simulation — Part 2: senior engineer (10+ years)

*Assume I just listened to the candidate’s pitch in [Part 1](./14-interview-part1-candidate.md). These are my notes — not an official score from any company.*

---

## Context

The candidate walked through a full-stack RBAC console: Express + PostgreSQL + Redis limits on the backend, React + React Query + a thin Zustand slice on the frontend, OpenAPI as contract, cookie session with refresh handling in Axios, and **server-side** automated tests. They were explicit about **what they did not polish yet** (client tests, form library usage, some UX shortcuts).

---

## Overall score: **7.5 / 10**

**What this number means:** This is a **portfolio / interview discussion** score — “would I believe this person can contribute to a real codebase?” — **not** “is this production at Netflix scale.” On that scale, **7.5** is **solidly above a tutorial project**: clear layering, real RBAC and API discipline, and honest scope control.

---

## What convinced me

**Backend**

- RBAC expressed as **capabilities** for the client while the server remains authoritative is the right story. The `/me`-style payload matches how good SPAs consume authorization.
- **PostgreSQL + migrations** and **OpenAPI served from the app** are strong signals for a learning or portfolio repo.
- **Layered Redis rate limiting** and structured errors are touches many candidates skip; they give us something concrete to discuss under abuse and client UX (`429`, `Retry-After`).
- **Automated tests** on the server (integration, migrations, limits, OpenAPI) are a real differentiator versus “I only tested manually.”

**Frontend**

- **Separation of concerns** is not just folder names — `services` vs `client` vs pages vs hooks is consistent with how teams ship SPAs.
- **React Query** usage (central `queryKeys`, invalidation after mutations, `keepPreviousData` for pagination) shows they understand **server cache** vs ad-hoc `useEffect` fetches.
- The **Axios interceptor** story (single-flight refresh, retry guard, auth endpoint exclusions, normalized errors) is exactly the depth I want in a live-coding or architecture discussion.
- **Capability-gated UI** plus acknowledgment that the server enforces anyway shows **defense in depth** awareness.
- **Written documentation** under `client/docs/` suggests they can onboard others — that matters for mid-level and above.

---

## What I would still verify in follow-up questions

I am not trying to trap them; I want to see **clarity under pressure**:

- **Sessions and cookies:** rotation, revocation, logout vs refresh, CSRF posture — I care that they know **what their code does** and what it does **not** promise.
- **Error contract:** walk one happy path and one validation error from `AppError` → envelope → `ApiClientError` → toast.
- **Scaling story:** if API runs on multiple nodes, what breaks or what stays true for JWT/session validation and rate limits?
- **Frontend gaps:** I will ask about **client tests** and **form validation** strategy. A good answer sounds like Part 1: prioritized API tests first, next steps are RTL/interceptor/`ProtectedRoute`, then `react-hook-form` + `zod`.
- **Small hygiene:** unrelated `package.json` keywords or dead claims on the resume — I notice inconsistencies.

---

## Resume / hire signal

If they present like **Part 1** — calm, specific file paths, honest about gaps — this project supports **junior-to-mid** “full-stack TypeScript” positioning, depending on the rest of their experience. For **senior**, I would expect them to go deeper on threat model, operability (CI, deploy, observability), and hardening — but this repo is a **credible anchor** for a system-design-style conversation, not just a todo demo.

---

## Verdict

This is **credible portfolio work**: architectural intent, contract-driven client, non-trivial backend concerns. The frontend is **coherent** and well documented. It does not need to pretend to be a billion-user system.

What separates a **good** interview from an **average** one here is not perfection — it is whether the candidate can **explain trade-offs, constraints, and the next iterations** like someone who has maintained software. Part 1 already heads in that direction; I would hire **curiosity and honesty** over defensiveness.

---

## Related docs

- [Part 1 — Candidate](./14-interview-part1-candidate.md)
- [Hub](./13-interview-simulation.md)
- [06 — Code Patterns, Strengths & Weaknesses](./06-patterns-strengths-weaknesses.md)
