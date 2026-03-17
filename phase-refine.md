# Phase Refinement Plan

## 1. Current Gaps Summary

The repository now passes all **engine unit tests** and meets the core type‑safety goals, but several critical pieces from the original solution remain incomplete:

| Gap                                        | Why it matters                                                                                                                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`any` usage in UI/Electron code**        | `any` defeats TypeScript’s static guarantees and can hide runtime errors in the user‑visible UI layer.                                                                                                                               |
| **Email PII masking**                      | The `maskPII` function masks e‑mail addresses as `alice*******e.com`, while the test suite (and security policy) expects `alice****e.com` (first 4 + `****` + last 4). Inconsistent masking can expose more characters than allowed. |
| **Integration tests failing**              | Playwright tests attempt to load the dashboard at `http://localhost:5173` but the dev server is never started in CI, causing `ERR_CONNECTION_REFUSED`. This means end‑to‑end behaviour is not verified.                              |
| **Missing `type-check` step in CI**        | The CI YAML runs lint and tests but never runs `npm run type-check`. Type errors could slip into production.                                                                                                                         |
| **Cross‑platform packaging not validated** | Build scripts exist, however CI never builds for macOS/Linux nor validates that the generated installers work.                                                                                                                       |
| **No `SECURITY.md`**                       | The solution called for a documentation file that lists required environment variables, security assumptions, and hardening measures. Without it, new contributors lack guidance.                                                    |
| **No runtime validation for HTTP inputs**  | Only IPC payloads are validated (via Zod). Headers, query strings, and post bodies that traverse the proxy are passed unchecked, exposing potential injection or malformed‑request bugs.                                             |
| **No tests for validation logic**          | The Zod schemas (`securityModeSchema`, `stressConfigSchema`) are exercised only indirectly. Dedicated unit tests are required to guarantee that malformed inputs are rejected.                                                       |

Addressing these gaps will bring the project to **100 % compliance** with the original solution specification.

## 2. Task Breakdown

### 📌 Task 1 – Eliminate `any` from UI/Electron Code

- **Problem** – The UI layer (renderer, preload, Electron helpers) still uses `any` for DOM objects, IPC bridges, and typed events, weakening type safety.
- **Files involved**
  - `src/gui/gui-renderer.ts` (multiple `any` usages)
  - `src/electron/ui/extras.ts`
  - `src/electron/ui/networks.ts`
  - `src/electron/setup-api.ts` (event emit signatures)
  - `src/pipeline/pipeline.ts` (event emitter typings)
  - Test files that deliberately use `any` (e.g., `network-interceptor.spec.ts`) – these can stay as they are test‑only.
- **Step‑by‑step fix**
  1. Add concrete interfaces for the objects currently typed as `any`.
     - Example: define `interface GuiBridge { atlasGui: … }` and `interface ControlBridge { atlasControls: … }`.
  2. Replace `(window as any).atlasGui` with a typed global declaration (e.g., `declare global { interface Window { atlasGui: AtlasGui; atlasControls: AtlasControls; } }`).
  3. In `extras.ts` and `networks.ts`, replace the `Atlas: any` prop with an explicit `Atlas` interface that mirrors the expected methods (`scanProjects`, `getReportFiles`, etc.).
  4. Update the `setup-api.ts` `emit` method signature to `emit(event: string, data?: unknown): void` and propagate `unknown` or a union type through the emitter.
  5. Refactor `pipeline.ts` to use a generic `EventMap` and `type Listener<E extends keyof EventMap> = (payload: EventMap[E]) => void`. This removes the `any` cast.
  6. Run `npm run type-check`; fix any compilation errors that surface.
  7. Re‑enable the ESLint rule `@typescript-eslint/no-explicit-any` and confirm there are zero warnings.
- **Risks** – UI code interacts with the DOM; over‑strict typings may cause runtime errors if the DOM element is missing. Mitigate by adding runtime guards (`if (window.atlasGui) …`) before first use.
- **Safe implementation** – All changes are compile‑time only; the runtime behaviour of existing functions remains unchanged because we only add typings and narrow the allowed shape.

### 📌 Task 2 – Align Email PII Masking with Test Expectations

- **Problem** – Current `maskPII` masks e‑mail addresses with a variable‑length asterisk block (`alice*******e.com`). The test suite (and security policy) expects exactly four asteris‑ks between the first four and last four characters (`alice****e.com`).
- **Files involved** – `src/engine/security-warden.ts`.
- **Step‑by‑step fix**
  1. Detect e‑mail pattern first (using `/^[^@]+@[^@]+\.[^@]+$/`).
  2. Preserve the first **four** characters of the entire e‑mail string, then insert exactly `"****"`, then append the last **four** characters (including the domain’s suffix).
  3. Ensure the logic still works for short strings (fallback to `"****"`).
  4. Update the comment block to reflect the new email‑masking rule.
  5. Run `npm test` – the `security-scanner.spec.ts` test should now pass.
- **Risks** – Over‑masking may truncate domain information needed for debugging; however the requirement is explicit, so we follow it.
- **Safe implementation** – The change only affects the pure function `maskPII`; no side effects.

### 📌 Task 3 – Make Playwright Integration Tests CI‑Ready

- **Problem** – Integration tests attempt to open the dashboard at `http://localhost:5173` but CI never starts the Vite dev server (or the compiled `dist` folder). This yields `ERR_CONNECTION_REFUSED`.
- **Files involved** – `tests/vrt/gui.vrt.spec.ts`, `tests/integration/violations.spec.ts`, `playwright.config.ts`.
- **Step‑by‑step fix**
  1. Add a **pre‑test script** that builds the UI and serves it. For CI we can use `npm run build:ui` (Vite) followed by `npx serve -s dist/gui -l 5173 &` to start a static server.
  2. Modify `playwright.config.ts` to include a `globalSetup` that runs the server and tears it down after all tests (`global‑teardown`).
  3. Ensure the server process is killed in the global teardown to avoid hanging workers.
  4. Update the CI YAML (`.github/workflows/ci.yml`) to run this new script before the Playwright steps (`npm run test:integration`).
  5. Verify locally (`npm run test:integration`) succeeds.
- **Risks** – The server may take longer to start than Playwright’s default timeout. Mitigate by adding a small `await new Promise(r => setTimeout(r, 2000))` after launch or configuring `waitUntil: 'load'` with a longer timeout.
- **Safe implementation** – All changes are confined to the test harness; production code is untouched.

### 📌 Task 4 – Add `type-check` Step to CI Pipeline

- **Problem** – CI does not verify TypeScript compilation (`tsc --noEmit`).
- **Files involved** – `.github/workflows/ci.yml`.
- **Step‑by‑step fix**
  1. Insert a new step after `npm run lint` : `- run: npm run type-check`.
  2. Ensure the `type-check` script in `package.json` (`"type-check": "tsc --noEmit"`) remains present.
  3. Validate that the workflow passes on the current codebase.
- **Risks** – A failing type‑check will block CI; however this is desired to surface regressions early.
- **Safe implementation** – Simple YAML edit; no runtime impact.

### 📌 Task 5 – Validate Cross‑Platform Packaging in CI

- **Problem** – Build scripts exist, but CI never builds for macOS/Linux nor verifies the artifacts.
- **Files involved** – `.github/workflows/ci.yml`, `package.json` scripts (`"pack"`).
- **Step‑by‑step fix**
  1. Extend the `build` job matrix to include a **Linux** and **macOS** step dedicated to packaging: after `npm run build`, run `npm run pack`.
  2. Upload the generated installers as **artifacts** using `actions/upload-artifact`.
  3. Optionally add a lightweight verification step (e.g., `npm run pack && ls release/*`) to ensure files exist.
  4. Keep the Windows build (already present) for completeness.
- **Risks** – Packaging for macOS may require a macOS runner (already in matrix) and signing may fail if no certificate is provided; we can set `GH_TOKEN` only and ignore signing warnings.
- **Safe implementation** – Packaging is a pure build step; failure only prevents CI success, which is intended.

### 📌 Task 6 – Create `SECURITY.md`

- **Problem** – No security‑related documentation file.
- **Files involved** – New file `SECURITY.md`.
- **Step‑by‑step fix**
  1. Write a concise markdown file that lists:
     - Required environment variables (`ATLAS_DOMAIN`, `ATLAS_PORT`, `ATLAS_MODE`, etc.).
     - Security assumptions (Electron sandboxing, disabled node integration, required `webSecurity`).
     - Masking behaviour for PII (credit‑card, email).
     - How to enable/disable stress testing and security modes.
     - Reporting process for security issues (contact, disclosure).
  2. Add a link to `SECURITY.md` from the project `README.md` (optional).
- **Risks** – None (documentation‑only).
- **Safe implementation** – Add file and commit.

### 📌 Task 7 – Add Runtime Validation for HTTP Inputs (Headers, Query Params)

- **Problem** – Only IPC payloads are validated; incoming HTTP requests forwarded by the proxy are not schema‑checked.
- **Files involved** – `src/engine/proxy-engine.ts`, `src/engine/validation.ts` (currently holds only IPC schemas).
- **Step‑by‑step fix**
  1. Extend `validation.ts` with two new Zod schemas:
     - `headersSchema` – object whose keys are strings and values are strings; optional whitelist of known sensitive headers.
     - `queryParamsSchema` – `z.record(z.string())` with optional pattern checks (e.g., disallow `\0` or excessively long values).
  2. In `proxy-engine.handleRequest`, before forwarding the request (`fetch(localUrl, …)`), validate:
     ```ts
     const headerValidation = headersSchema.safeParse(request.headers());
     if (!headerValidation.success) {
       this.callbacks.onViolation({ source: 'Security Warden', message: `Invalid request headers`, … });
       await request.abort('blockedbyclient');
       return true;
     }
     // similarly for query params from URL.searchParams
     ```
  3. For query params, parse `url.searchParams` into a plain object and run `queryParamsSchema`.
  4. Allow a whitelist of benign headers when in “Standard” mode, but reject malformed values in “Strict”.
- **Risks** – Over‑strict validation may block legitimate third‑party APIs. Mitigate by allowing a whitelist (e.g., `Accept`, `User-Agent`) and only rejecting malformed values.
- **Safe implementation** – Validation occurs **before** any network request; if it fails we abort the request and log a violation. No changes to successful request flow.

### 📌 Task 8 – Add Unit Tests for Validation Logic

- **Problem** – No explicit tests ensure that malformed IPC payloads or HTTP inputs are rejected.
- **Files involved** – New test file `src/engine/validation.spec.ts`.
- **Step‑by‑step fix**
  1. Write tests for `securityModeSchema` and `stressConfigSchema` (already indirectly covered) – add negative cases (wrong enum, negative numbers, missing fields).
  2. Write tests for the newly added `headersSchema` and `queryParamsSchema`:
     - Valid header object passes.
     - Header with a non‑string value fails.
     - Query param with prohibited characters fails.
  3. Use Jest’s `expect().toThrow()` or Zod’s `safeParse` result to assert failures.
  4. Ensure test coverage reaches > 90 % for `validation.ts`.
- **Risks** – Tests must import the same schemas used by the production code; any mismatch will be caught early.
- **Safe implementation** – Pure test code; will not affect runtime.

## 3. Priority Order

| Phase                                            | Tasks                                                                                               | Rationale                                                                                             |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Phase 1 – Critical security & CI correctness** | Task 2 (email masking), Task 4 (type‑check CI), Task 7 (HTTP validation), Task 8 (validation tests) | Guarantees that the core security behaviour matches the specification and that CI blocks type errors. |
| **Phase 2 – Stability & Release readiness**      | Task 3 (integration test server), Task 5 (cross‑platform packaging), Task 1 (remove `any` from UI)  | Improves reliability of the test suite and builds, and upgrades UI type safety.                       |
| **Phase 3 – Documentation & Polish**             | Task 6 (SECURITY.md)                                                                                | Provides the missing governance artifact; low risk, high value for maintainers.                       |

## 4. CI & Verification Strategy

1. **Static Type Safety**
   - `npm run lint` → `npm run type-check` → ensure **zero** TypeScript errors.
   - Add a separate job `type-check` that fails fast if any `any` remains in `src/**/*.ts` (e.g., `grep -R "any" src/engine | wc -l` must be 0 after Task 1).

2. **Unit Test Coverage**
   - `npm run test:unit` must report **100 %** passing and **≥ 90 %** coverage for `src/engine/validation.ts`.
   - Enforce coverage thresholds in `jest.config.js` (`coverageThreshold`).

3. **Integration / E2E Tests**
   - In CI, the `build` job will run `npm run build:ui` then start a static server on port 5173 via a global setup script.
   - Playwright tests will execute against this server.
   - Add a step that curls `http://localhost:5173` after server start to confirm the UI is reachable before launching Playwright.

4. **Packaging Validation**
   - After `npm run pack`, the workflow uploads the `release/*` artifacts.
   - A follow‑up job (optional) can unpack the installer on the runner and verify that the expected executable exists (`file` command on Linux, `Get-Item` on Windows).

5. **Security Regression Checks**
   - Run a dedicated test (`npm run test:security`) that invokes `maskPII` with credit‑card and e‑mail examples, ensuring the exact masked format.
   - Include a lint rule (`no-restricted-syntax` for string literals containing raw secrets).

6. **Documentation Lint**
   - Add a simple script (`npm run docs:check`) that validates the existence of `SECURITY.md` and that it contains required headings (`## Required Environment Variables`, `## PII Masking`). CI will fail if the file is missing.

## 5. Definition of Done

- **All `any` usages** in production UI/Electron code are replaced by concrete TypeScript interfaces; the repository passes `npm run type-check` with **zero** warnings for `any`.
- **Email masking** now exactly matches the test expectation (`first 4 + "****" + last 4`). All related tests (`security-scanner.spec.ts`) pass.
- **Playwright integration suite** runs successfully in CI, with the dev server automatically started; zero test failures.
- **CI pipeline** includes a `type-check` step, builds and packages for Windows, macOS, and Linux, and uploads the installers as artifacts.
- **`SECURITY.md`** exists, accurately documents env vars, masking rules, Electron security defaults, and contribution guidelines.
- **HTTP input validation** (headers, query params) is implemented in `proxy-engine.ts` using Zod schemas, and **negative cases** are covered by new unit tests in `validation.spec.ts`.
- **All unit and integration tests** (including new validation tests) pass, with code coverage ≥ 90 % for validation logic.
- The repository’s `npm test` command runs both unit and integration suites without manual intervention.
- A **release** can be created via `npm run pack` on any of the three CI matrix platforms, producing functional installers.

Once every item above is satisfied, the project will be **fully aligned with solution.md** and ready for production deployment.
