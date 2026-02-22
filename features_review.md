# Atlas Features Review List

Here is the complete list of all 8 features currently present in Atlas.

## 1. Core Browser & Execution
- **Domain Masking:** Replaces `localhost:PORT` with a custom production-like domain (e.g., `my-app.com`).
- **Headless/UI Mode:** Opens a visible Chrome window in Kiosk mode.
- **Auto-Server Start:** Detects `package.json`, installs dependencies, and runs the local dev server.
- **CLI Commands (Init & Run):** `atlas init` creates the config file. `atlas run` starts the server and browser.

## 2. Immortal UI Shell (The Atlas Pill)
- **Persistent Overlay (HUD):** Top bar with URL lock, domain mapping, back/forward buttons, and close button.
- **Draggable Pill:** Floating circular button that opens the tools menu.
- **Immortal UI:** Pill and HUD survive page navigations and refreshes.

## 3. Console Tab
- **Console Capture:** Intercepts all `console.log`, `console.warn`, `console.error`, `console.info`, `console.debug`.
- **Error Capture:** Catches uncaught exceptions (`window.error`) and unhandled promise rejections.
- **Stack Traces:** Expandable stack traces on error entries.
- **Filter Bar:** Filter by level (All, Errors, Warnings, Info, Logs, Debug) with live counts.
- **PII Detection:** Scans console output for leaked credit cards, auth tokens, and emails.

## 4. Networks Tab (Real-Time Responses)
- **Live Request Logging:** Intercepts all HTTP requests showing Name, Status, Type, Size, and Time.
- **Response Bodies:** Captures full response bodies from the server in real-time.
- **Detail Panel (Chrome DevTools style):**
  - **Headers** — General info, request headers, response headers.
  - **Preview** — Formatted JSON/text preview of the response body.
  - **Response** — Raw response body.
  - **Cookies** — Cookies sent with the request.
- **Type Filters:** Filter by All, Fetch/XHR, Doc, JS, CSS, Img.
- **Search Filter:** Text search across request URLs.
- **Per-Page Isolation:** Only shows requests relevant to the current page (SPA-aware).

## 5. Application Tab
- **Page Info:** Title, URL, charset, DOCTYPE, ready state, content-type.
- **Meta Tags:** Lists all `<meta>` tags with name and content.
- **Scripts:** Count of external vs inline scripts, with full URL list.
- **Stylesheets:** Count of external vs inline styles, with full URL list.
- **Cookies:** Lists all cookies with name and value.
- **LocalStorage:** Lists all keys with truncated values.
- **SessionStorage:** Lists all keys with truncated values.

## 6. Storage Tab
- **Total Page Weight:** Combined DOM + transfer size.
- **Size Breakdown:** Visual bars for DOM, Images, JavaScript, CSS, Fonts, Other.
- **Client Storage:** Visual bars for LocalStorage, SessionStorage, Cookies.
- **Top 10 Heaviest Resources:** Ranked by size with type, path, and load duration.

## 7. Scalability Tab (2 sub-tabs)
- **Stressors (sub-tab):**
  - Error Rate slider (500s) — 0-50%.
  - Latency Spike slider (2-5s delay) — 0-50%.
  - Enable/Disable toggle.
- **Live Monitor (sub-tab):**
  - Shows all non-security violations (stability events) in real-time.
  - Deduplicated entries with count badges.
  - Expandable JSON details per violation.

## 8. Security Tab
- **Warden Mode:** Toggle between Standard (Log Only) and Strict (Block Insecure).
- **PII Leak Detection:** Scans network response bodies for emails, credit cards, and auth tokens (JWT, AWS keys).
- **CORS Strictness:** Flags responses with `Access-Control-Allow-Origin: *`.
- **Violation Log:** Deduplicated security violations with timestamps and expandable JSON.

## 9. Extras Tab (2 sections)
- **Session Recording:**
  - Start/Stop recording button.
  - Records browser session into MP4 via Puppeteer + ffmpeg.
  - Supports pause/resume with multi-part video merging.
- **Project Utilities:**
  - Force Reload Project button.

## 10. Auto Journey Report Generator (Background)
- **Not a tab** — runs automatically in the background.
- Tracks all navigations with per-page metrics (load time, storage).
- On exit, generates `atlas-audit-report.md` with tree-structured journey report.
- On exit, generates `atlas-audit-report.json` with all violations.
- Saves session recording video to `atlas_reports/` directory.

---
_Reference document for Atlas 2.0 restructuring._
