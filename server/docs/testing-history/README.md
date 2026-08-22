# Testing history

This folder keeps the official result history for each test suite version.

## Version summary

| Version | Status | Purpose | Result doc |
|---|---|---|---|
| `v1` | Archived | Original integration baseline | [v1.md](./v1.md) |
| `v2` | Active | Main full-reset integration regression suite | [v2.md](./v2.md) |
| `v3` | Completed | Migration-specific verification | [v3.md](./v3.md) |
| `v4` | Completed | Rate-limit-specific verification | [v4.md](./v4.md) |
| `v5` | Completed | OpenAPI contract verification | [v5.md](./v5.md) |

## Rules

- Every suite version should have its own result doc here.
- `tests/README.md` should always point to this history.
- `docs/testing.md` should describe the current strategy, not the entire archive.
- `learning_readme` can contain deeper study notes, but this folder is the official source of suite history.

---

Previous: [Testing](../testing.md) for the current strategy.
Next: [v2.md](./v2.md), the active suite's result log.
