# Atlas Sandbox v1.1.1

## 🚀 Overview
This is a critical stability patch addressing regressions in target discovery and proxy header handling introduced in v1.1.0.

## 🛠️ Key Bug Fixes

### 1. **Enhanced Target Discovery**
- Updated the connection logic in `src/browser/browser.ts` to be more inclusive of different Electron/Chromium versions.
- Atlas now accurately identifies the Guest viewport even when reported as a standard `page` or `other` type.
- Added detailed "Scanning target" logging with `MATCHED`/`SKIPPED` status for easier field debugging.

### 2. **Proxy Resilience & Header Fixes**
- **Removed manual `Host` header override**: Restored default `fetch` behavior to prevent request rejection by backend servers and libraries that strict-check the Host header.
- **GET/HEAD Safety**: Corrected `fetch` body handling to avoid illegal body errors on non-POST methods.

### 3. **Report Generation Hardening**
- Implemented `try-catch` wrappers for URL parsing in `report-utils.ts`.
- The audit report generator now gracefully handles malformed or empty captures, ensuring the session summary is saved even if errors occurred during the session.

### 4. **CLI Updates**
- Corrected all version markers to `v1.1.1`.

---
## 📦 Version Information
- **Tag**: `v1.1.1`
- **Release Type**: Patch (Stability Focus)
- **Minimum Node**: `>=18.0.0`
