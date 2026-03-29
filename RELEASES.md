# Atlas Sandbox Release History

All notable changes to the Atlas Sandbox project will be documented in this file. This project adheres to Semantic Versioning.

---

## [v1.1.5] - 2026-03-29

### 🚀 Overview
Hotfix for CI build failure and final stabilization of the initialization gate.

### 🛠 Fixes & Refinements
1. **CI Compliance**: Resolved `no-explicit-any` lint errors by introducing a formal `NetworkInterceptor` interface across the browser and engine layers.
2. **Synchronized Boot**: Finalized the project initialization gate to ensure the "Ready before Render" state is 100% reliable.

---

## [v1.1.4] - 2026-03-29 (Failed CI)

---

## [v1.1.3] - 2026-03-29

### 🚀 Overview
Network stability patch eliminating duplicate request logging, fixing the fatal "Requesting main frame too early" crash, resolving Pixy Proxy 406 errors on `target="_blank"` links, and introducing a premium Atlas Loading Screen.

### 🛠 Key Fixes
1. **Eliminated Duplicate Network Requests**
   - Link Scanner HEAD/GET validation fetches are now tagged `x-atlas-internal: link-scan` and transparently skipped by the proxy logger — zero impact on the Network tab.
2. **Fixed Fatal Process Crash**
   - `startLinkScanner` called `p.url()` on pages not yet attached by Chromium if navigation was fast.
   - All `p.url()` calls in the link scanner are now wrapped in `try/catch` with `about:blank` filtering.
3. **Fixed `target="_blank"` Links → Pixy Proxy 406**
   - New tabs opened via `_blank` links are now handled by `framenavigated` — interceptor attaches at the very start of the real navigation.
   - Stable deduplication via `Set<Target>` prevents double-setup on renderer process swaps.
4. **New: Atlas Loading Screen**
   - A premium dark glassmorphism overlay (`#__atlas_shield`) is injected before any page scripts via `evaluateOnNewDocument`.
   - Injected directly into proxied HTML bodies for 100% reliable dismissal.
   - Automatically fades out once Atlas has full proxy control.

---

## [v1.1.2] - 2026-03-28

### 🚀 Overview
Global stability patch addressing regressions in target discovery, proxy header handling, and CI-specific resource leaks.

### 🛠 Key Bug Fixes
1. **Enhanced Target Discovery**:
   - Updated the connection logic in `src/browser/browser.ts` to be more inclusive of different Electron/Chromium versions.
   - Atlas now accurately identifies the Guest viewport even when reported as a standard `page` or `other` type.
2. **Proxy Resilience & Header Fixes**:
   - Resolved the Node.js 18+ IPv4/IPv6 "fetch failed" bug by targeting `127.0.0.1` instead of `localhost`.
   - Restored `Host` header pass-through to ensure the backend application correctly identifies the masked domain.
3. **CI Stabilization (The "Green CI" Fix)**:
   - Ensured all timers are cleared on both success and failure to prevent Jest worker process hangups.
   - Eliminated linting violations (`no-explicit-any`) for total build compliance.

---

## [v1.1.1] - 2026-03-28
- **Fix**: Replaced explicit `any` with `ReturnType<typeof setTimeout>` in `server.ts` to satisfy strict linting.

## [v1.1.0] - 2026-03-28
- **Fix**: Resolved port conflict issues and improved internal bridge stability.

## [v1.1.0-alpha] - 2026-03-28
- **Feature**: Initial multi-tab support research and CDP protocol enhancements.

---

## [v1.0.4] - 2026-03-27
- **CI**: Granted release permissions and configured tag-based triggers for automated builds.

## [v1.0.3] - 2026-03-26
- **Version Bump**: Enhanced HTTP error reporting and improved stability in manual mode.

## [v1.0.2] - 2026-03-25
- **Build**: Limited build targets to Windows only to reduce release artifact clutter and speed up CI.

## [v1.0.1] - 2026-03-24
- **Installer**: Forced tracking of `installer.nsh` to ensure custom installation steps are included in the `.exe`.

## [v1.0.0] - 2026-03-24
- **Initial Release**: Launch of Atlas Sandbox with base proxy engine, domain masking, and sandbox architecture.
