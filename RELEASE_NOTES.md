# Atlas Sandbox v1.1.0

## 🚀 Overview
This release focuses on systemic stability and performance, resolving critical 502 Proxy Errors and port race conditions that affected application startup in complex environments.

## 🛠️ Key Improvements & Bug Fixes

### 1. **Port Guard Strategy** (New)
- Replaced unsafe port allocation with a deterministic `reservePort` mechanism.
- Ports are now held by the system until the exact moment of child process spawning, eliminating "Address already in use" errors during multi-step initialization.

### 2. **Proxy Resilience (Pixy Engine)**
- Added **30-second timeouts** to proxy requests via `AbortSignal`, preventing browser hangs on stagnant connections.
- Fixed **Host Header Forwarding**: Correctly overrides the `host` header to `localhost` for internal routing while preserving the original host in `x-forwarded-host`.
- Enhanced stream handling for improved performance under high load.

### 3. **Smart Readiness Checks**
- Upgraded the server readiness monitor to require **two consecutive successful health checks** before marking the sandbox as "Ready".
- Now correctly ignores unstable 500-level errors during cold starts.

### 4. **Environment & Performance**
- Removed forced `NODE_ENV=production`; Atlas now respects the developer environment or defaults to `development` for better debugging.
- Re-enabled **Browser Caching** for guest pages to reduce proxy overhead and significantly improve interaction speed.

---
## 📦 Version Information
- **Tag**: `v1.1.0`
- **Release Type**: Minor (Stability Focus)
- **Minimum Node**: `>=18.0.0`
