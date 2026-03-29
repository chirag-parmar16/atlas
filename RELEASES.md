# Atlas Sandbox Release History

All notable changes to the Atlas Sandbox project will be documented in this file. This project adheres to Semantic Versioning.

---

## [v1.1.4] - 2026-03-29

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

## [v1.1.3] - 2026-03-29
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
