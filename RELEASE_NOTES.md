# Atlas Sandbox v1.1.3

## 🚀 Overview

Network stability patch eliminating duplicate request logging, fixing the fatal "Requesting main frame too early" crash, resolving Pixy Proxy 406 errors on `target="_blank"` links, and introducing a premium Atlas Loading Screen.

## 🛠 Key Fixes

1. **Eliminated Duplicate Network Requests**
   - Link Scanner HEAD/GET validation fetches are now tagged `x-atlas-internal: link-scan` and transparently skipped by the proxy logger — zero impact on the Network tab.

2. **Fixed Fatal Process Crash**
   - `startLinkScanner` called `p.url()` on pages not yet attached by Chromium → `"Requesting main frame too early!"` → process killed.
   - All `p.url()` calls in the link scanner are now wrapped in `try/catch` with `about:blank` filtering.

3. **Fixed `target="_blank"` Links → Pixy Proxy 406**
   - New tabs opened via `_blank` links are now handled by `framenavigated` — interceptor attaches at the very start of the real navigation, before any resource requests fire.
   - Stable deduplication via `Set<Target>` prevents double-setup on renderer process swaps.

4. **New: Atlas Loading Screen**
   - A premium dark glassmorphism overlay (`#__atlas_shield`) is injected before any page scripts via `evaluateOnNewDocument`.
   - Automatically fades out (0.5s ease) once Atlas has full proxy control and tabId is resolved.
   - Zero flash, zero Pixy Proxy exposure.

5. **CI/CD Release Flow Fixed**
   - `npm run dist -p always` now only runs on `v*` tag pushes, not on every main branch push.

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
