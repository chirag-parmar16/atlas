# Atlas Sandbox v1.1.3

### 🚀 Overview
Critical stability patch for Atlas Loading Lifecycle. Implemented a network-level readiness gate to prevent premature rendering of uncontrolled projects and eliminated the "double-loading" effect.

### 🛠 Key Stabilizations
1. **Project Initialization Gate**
   - The `ProxyEngine` now holds the initial project HTML response until Atlas signals "Full Control Ready" (TabID resolved, Interceptor active).
   - This eliminates the "Raw Render" flash of uncontrolled projects at boot.
2. **Optimized Loading Screen Lifecycle**
   - The Loading Shield now uses a robust `window.__ATLAS_READY__` flag.
   - Dismissal script injected immediately after opening `<body>` tag to suppress loader on internal navigations.
3. **Double-Load Elimination**
   - Removed the redundant `page.reload()` and replaced it with a unified network-level holding pattern.
   - The very first navigation now results in a perfectly initialized state.

---

# Atlas Sandbox v1.1.2


## 🚀 Overview

This is the definitive stability patch (v1.1.2) addressing regressions in target discovery, proxy header handling, and CI-specific resource leaks.

## 🛠 Key Bug Fixes

1.  **Enhanced Target Discovery**:
    *   Updated the connection logic in `src/browser/browser.ts` to be more inclusive of different Electron/Chromium versions.
    *   Atlas now accurately identifies the Guest viewport even when reported as a standard `page` or `other` type.
    *   Added detailed "Scanning target" logging with `MATCHED / SKIPPED` status for easier field debugging.

2.  **Proxy Resilience & Header Fixes**:
    *   Resolved the Node.js 18+ IPv4/IPv6 "fetch failed" bug by targeting `127.0.0.1` instead of `localhost`.
    *   Restored `Host` header pass-through to ensure the backend application correctly identifies the masked domain.
    *   Implemented `try/finally` blocks in `src/engine/proxy-engine.ts` to ensure proxy timeouts are cleaned up immediately, preventing memory leaks.

3.  **CI Stabilization (The "Green CI" Fix)**:
    *   Properly scoped `startupTimer` in `src/server/server.ts` to prevent `ReferenceError` in manual mode.
    *   Ensured all timers are cleared on both success and failure to prevent Jest worker process hangups.
    *   Eliminated linting violations (`no-explicit-any`) for total build compliance.

- **Tag**: `v1.1.2`
