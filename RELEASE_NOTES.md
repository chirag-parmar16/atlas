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
