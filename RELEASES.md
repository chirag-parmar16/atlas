# Atlas Sandbox Release History

All notable changes to the Atlas Sandbox project will be documented in this file. This project adheres to Semantic Versioning.

---

## [v1.0.1] - 2026-03-29

### 🔥 Critical Hotfix — Loading Screen Deadlock

**Bug:** The loading screen was stuck in an infinite loop ("SECURING CONNECTION..." never dismissed).

**Root Cause:** `setInitialized()` was being called after `page.goto()`, creating a deadlock:
- `goto()` sends a document request → proxy holds it (gate closed) → `goto()` waits for response → `setInitialized()` never reached → infinite wait.

**Fix:**
1. **Loading screen injected IMMEDIATELY** when the webview is first attached — before `setupPage()` starts its ~2s tabId polling window. This eliminates the raw localhost flash the user saw.
2. **`setInitialized()` restored to inside `setupPage()`** — opens the proxy gate BEFORE `goto()` is called, so the navigation can proceed without deadlock.
3. The proxy still injects `__atlasReady()` into every HTML response body, which correctly dismisses the loading screen once the masked domain page is fully served.

---

## [v1.0.0] - 2026-03-29

### 🚀 Initial Stable Release
This version represents the first production-ready release of the Atlas Sandbox, incorporating all the latest stability enhancements and lifecycle orchestration logic.

### 🌟 Core Capabilities
1. **Production Domain Masking**
   - Seamlessly proxy any local application to a production-grade external domain for testing and analysis.
2. **Project Initialization Gating**
   - Strict network-level holding pattern ensures that the user project never renders until Atlas has "Full Control" (Auth, Interceptors, TabID resolution).
   - Loading shield is now correctly held until `[Atlas] Navigating to http://domain...` completes — the exact moment domain control is acquired.
3. **Premium Loading System**
   - Integrated dark glassmorphism loading shield (`#__atlas_shield`) with robust dismissal logic via `window.__ATLAS_READY__`.
   - `setInitialized()` is deferred to AFTER the first `page.goto()` to the masked domain — not on interceptor attachment. This eliminates premature dismissal.
4. **Enhanced Proxy Stability**
   - Resolved common Chrome-based sandbox issues like "Requesting main frame too early", 406 proxy rejections on `target="_blank"` links, and header pass-through resilience.
5. **Session Monitoring & Analysis**
   - Integrated violation detection, network request auditing, and storage metrics collection.

---
