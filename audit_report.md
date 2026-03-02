# 🛡️ Atlas Deep Security & Architectural Audit Report

## 1. Executive Summary
Atlas is a sophisticated tool designed to bridge the gap between local development and production-like environments through domain masking, network interception, and automated auditing. While the architecture is modular and technically impressive, the audit reveals several **critical security vulnerabilities** and **stability risks** that must be addressed before it can be considered truly production-ready for general enterprise use.

Key highlights:
- **Architecture:** Solid multi-layer design using a typed event pipeline.
- **Security:** Critical risks found in command execution and file system access.
- **Production Readiness:** **Partial**. Stability is high for intended use cases, but security isolation is insufficient for untrusted local projects.

---

## 2. Architecture Audit
### Layer-by-Layer Breakdown
- **CLI Layer (`src/cli/`):** Cleanly separates user intent from runtime logic. Handles configuration initialization.
- **Orchestration Layer (`src/browser/`, `src/electron/`):** Manages the lifecycle of Electron and Puppeteer. Connects the two via CDP.
- **Engine Layer (`src/engine/`):** The "Brain". Handles proxying, security scanning, performance monitoring, and chaos injection.
- **Pipeline Layer (`src/pipeline/`):** The "Central Nervous System". Facilitates decoupled communication between layers.
- **Host UI Layer (`src/electron/renderer.ts`, `src/gui/`):** Provides the HUD and Dashboard for developers.

### Coupling & Separation of Concerns
- **Good:** The `Pipeline` bus prevents tight coupling between collectors and the report manager.
- **Bad:** `browser.ts` is a "God File" (600+ lines) handling orchestration, connection, injection, and navigation.
- **Circular Dependencies:** None detected in primary flows, though `engine` modules have some high-level interdependence on `state.ts`.

---

## 3. Security Risk Table

| ID        | Risk Category     | Severity   | Description                                                                                                    | Mitigation                                                        |
| :-------- | :---------------- | :--------- | :------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------- |
| **SR-01** | Command Injection | 🔴 Critical | `spawn` with `shell: true` in `server.ts` uses project-controlled `package.json` scripts.                      | Use `shell: false` and strictly validate scripts/args.            |
| **SR-02** | FS Traversal      | 🟠 High     | `read-file` in `project-scanner.ts` allows reading any `.md` or `.txt` file on the system.                     | Restrict reads to a allowlist of project directories.             |
| **SR-03** | Sandbox Breakout  | 🟠 High     | `webSecurity: false` in Electron sandbox allows cross-site scripting risks if navigating to untrusted origins. | Enable `webSecurity` and use the proxy to handle CORS.            |
| **SR-04** | Exposed Controls  | 🟡 Medium   | Sensitive functions (`setSecurityMode`, `closeBrowser`) exposed to Guest JS via `exposeFunction`.              | Use a more secure event-based signal instead of direct functions. |
| **SR-05** | Env Leakage       | 🟡 Medium   | CLI passes full `process.env` to Electron, which might contain sensitive credentials.                          | Pass only a filtered allowlist of environment variables.          |
| **SR-06** | Insecure deps     | 🟡 Medium   | `atlas run` executes `npm install` automatically. Attackers could add malicious pre-install scripts.           | Require manual install or add an interactive prompt.              |

---

## 4. Code Smell List
1. **God Files:** `src/browser/browser.ts` needs modularization.
2. **Blocking Drive Scan:** `scan-projects` scans entire Windows drives synchronously, causing UI lag on startup.
3. **Manual Arg Parsing:** `atlas.ts` uses a manual loop for flags instead of full `commander` features.
4. **String-Match Security:** `run.ts` detects violations using basic string containment (e.g., `m.includes('violation')`), which is prone to false positives/negatives.
5. **Redundant Logic:** `readConsole` is duplicated across `init.ts` and `run.ts`.

---

## 5. Refactor Roadmap
| Priority     | Task                 | Description                                                       |
| :----------- | :------------------- | :---------------------------------------------------------------- |
| **Critical** | Secure `spawn` calls | Remove `shell: true` and sanitize `package.json` inputs.          |
| **High**     | Path Scoping         | Implement a "Project Root" constraint for all file reads.         |
| **High**     | Browser Split        | Break `browser.ts` into `Orchestrator`, `Injector`, and `Bridge`. |
| **Medium**   | Async Drive Scan     | Move drive scanning to a background worker or make it lazy.       |
| **Medium**   | Config Validation    | Use Zod or similar for `atlas.config.json` schema validation.     |

---

## 6. Final Stability Rating: 82/100
**Justification:** The core engine is extremely stable and handles process lifecycle well. The use of `tree-kill` and robust retry logic for CDP make it reliable for daily use.

---

## 7. Production Readiness Verdict: Partial
**Verdict:** **No** (for enterprise deployment), **Yes** (for local solo developer use).
**Why?** The security vulnerabilities (SR-01, SR-02) allow a malicious local project to gain RCE or read private files. It is safe only if the developer trusts the code they are sandboxing.

---

## 8. What would break under scale?
- **Memory Consumption:** Managing many tabs with Puppeteer + Electron will quickly consume several GBs of RAM.
- **Reporting:** `ReportManager` flushes the entire JSON to disk every 2 seconds. With 1000+ violations, this becomes a blocking I/O bottleneck.
- **Network Pipeline:** Single-threaded `EventEmitter` for all network events may become a bottleneck under high-request load (e.g., stress testing).

---

## 9. What would break under malicious attack?
- **Host Takeover:** A malicious site could call `atlasCloseBrowser()` or manipulate the audit results via exposed bridge functions.
- **Data Theft:** Using the `read-file` vulnerability, an attacker can steal configs, SSH keys (if named .txt), or project notes.
- **Resource Exhaustion:** A page could spam `console.log` to flood the IPC bridge and freeze the Host UI.

---

## 10. Suggested Next Version Architecture
1. **Worker Threads:** Move network interception and security scanning to a separate worker thread.
2. **True Proxy:** Instead of Puppeteer `HTTPRequest.respond`, use a real local HTTP proxy (e.g., `moxy`) for better compatibility.
3. **Capability System:** Instead of exposing raw functions to the Guest, use a secure message-passing protocol where the Host must approve sensitive actions.
4. **Plugin Architecture:** Move Collectors (Storage, Links) into a plugin system to keep the core lean.

---

## 11. Final Risk Score: 7.5/10 (High Risk)
**Top 10 Critical Risks:**
1. Command Injection via `package.json` [SR-01]
2. Path Traversal in GUI `read-file` [SR-02]
3. Cross-Site Scripting via `webSecurity: false` [SR-03]
4. Malicious `npm install` execution [SR-06]
5. Unauthorized Host Control via Bridge Functions [SR-04]
6. Environment Variable leakage to Electron [SR-05]
7. Unbounded Drive Scanning (Denial of Service)
8. Incomplete PII Regex (False sense of security)
9. Lack of Config Schema Validation (Injection via config)
10. Zombie processes if `killElectron` fails (Resource leak)

**Mitigation Steps:**
1. Patch `spawn` to avoid shell execution.
2. Implement strict path validation in `src/gui/project-scanner.ts`.
3. Enable `webSecurity` and use the proxy for CORS handling.
4. Filter environment variables before spawning Electron.
5. Add a confirmation prompt before running `npm install`.

---
**Overall Production Readiness Score: 68/100**
*Justification: Feature-rich and stable execution model, but critical security flaws in command handling and file access prevent a higher score.*
