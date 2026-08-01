# Frontend Configurations Guide

## 🛠️ The Core Build System: `vite.config.ts`

### Plugins (`plugins`)
*   **`react()`**: Integrates Vite with React, enabling fast builds, JSX compilation, and Fast Refresh (instant updates on file changes).
*   **`tailwindcss()`**: Integrates the brand-new Tailwind CSS v4 compiler directly into Vite's pipeline for ultra-fast utility class styling.

### Resolve Path Alias (`resolve.alias`)
*   Maps `@/` directly to the `src` folder. This allows you to import local files using clean absolute-looking paths (e.g., `import Button from '@/components/Button'`) rather than relative hell (e.g., `../../components/Button`).

### Reverse Proxy Server (`server.proxy`)
*   Configures a reverse proxy so that any request starting with `/api` during development (e.g., calling `/api/auth/login` on the client) is automatically forwarded to the backend running at `http://localhost:8000`. This prevents CORS issues without having to modify backend security settings for local development.

### Unit & Component Testing (`test`)
*   **`globals: true`**: Exposes Vitest global hooks (like `describe`, `it`, `expect`) globally, meaning you don't have to import them at the top of every test file.
*   **`environment: 'jsdom'`**: Simulates a web browser's DOM environment in Node.js, allowing you to mount and test React components easily.
*   **`coverage`**: Uses `v8` to analyze code execution during tests and exports a complete test coverage report (ignoring non-functional files like `schema.ts` or `main.tsx`).

---

## 📐 The TypeScript Compiler Architectures: `tsconfig` Files

Your frontend splits compilation concerns into two separate contexts using a composite project setup referencing distinct compiler configs from the master `tsconfig.json`.

### Master Project Reference: `tsconfig.json`
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

### Browser Application Context: `tsconfig.app.json`
*   This configures compiling the files inside `src` which are executed in the browser.

### Node Tools Context: `tsconfig.node.json`
*   This configures type checking for configuration files executed in a Node.js context (specifically `vite.config.ts` itself).

---

## 🧼 Code Standards & Linting: `eslint.config.js`

*   **`eslint.config.js`**: Uses the new modular ESLint Flat Config format to declare code quality and syntax check guidelines.

---

## 🎭 E2E Browser Testing: `playwright.config.ts`

*   **`playwright.config.ts`**: Sets up the execution behavior for your integration testing suite via Playwright.
*   **`testDir: './e2e'`**: Directs Playwright to scan the `./e2e` folder for all test suites.
*   **`fullyParallel: true`**: Maximizes system hardware capabilities by executing all tests concurrently.

### `use` Configuration
*   **`baseURL`**: Defines your client's running URL so you can use relative navigation actions in test files (e.g. `page.goto('/login')`).
*   **`screenshot: 'only-on-failure'`**: Automatically saves screenshots of failed runs in the `./test-results` folder.

### `webServer` Bootstrapping
*   Playwright doesn't require you to start the client in a separate terminal before running tests. It automatically boots the client using the command `pnpm exec vite --port 5174 --strictPort`, waits until port `5174` becomes active, runs the E2E tests, and then shuts down the client server when finished.
