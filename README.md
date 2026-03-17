# 🗺️ Atlas

[![Atlas CI/CD](https://github.com/chirag-parmar16/atlas/actions/workflows/ci.yml/badge.svg)](https://github.com/chirag-parmar16/atlas/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](https://github.com/chirag-parmar16/atlas/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **The Electron-Powered Standalone Sandbox for Universal Web Development**

Atlas is a powerful **standalone development sandbox** powered by **Electron**. It launches your web projects in an isolated browser window with a built-in devtools overlay. It acts as a transparent proxy between your application and the browser, allowing you to simulate production environments (custom domains, chaos engineering) without modifying your code.

---

## 🚀 Installation

Atlas is distributed as a standalone executable for Windows, macOS, and Linux.

1. **Download the latest installer** for your platform from the [GitHub Releases page](https://github.com/chirag-parmar16/atlas/releases):
   - **Windows**: `.exe` or `.msi`
   - **macOS**: `.dmg` or `.app.zip`
   - **Linux**: `.AppImage` or `.deb`
2. **Install the application**:
   - **Windows**: Double-click the installer. Atlas will automatically install and configure your system `PATH`.
   - **macOS**: Open the `.dmg` and drag Atlas to your `Applications` folder.
   - **Linux**: Make the `.AppImage` executable (`chmod +x`) or install the `.deb` package.
3. You can now use the `atlas` command globally from any terminal! (Note: On macOS and Linux, the binary is named `atlas`).

*Note: Your projects must be running on Node.js v18+.*

### ⚠️ Troubleshooting Installation (IDE Terminals)
If you installed Atlas while your IDE (like VS Code) was already open, the integrated terminal may not instantly recognize the `atlas` command because it caches old environment variables.

To fix this, you can fully restart your IDE, OR run this command in your PowerShell terminal to hot-reload the `PATH`:
```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

---

## 💻 Usage

Atlas requires initialization before running a project. Follow these steps:

### 1. Navigate to Your Project
```bash
cd /path/to/your/project
```

### 2. Initialize Atlas
```bash
# Interactive prompt (Not recommended for Windows executable)
atlas init

# Or provide the domain directly (Recommended)
atlas init example.com
```

This creates an `atlas.config.json` file in your project directory. Atlas auto-detects your project type (Node, React, Vue, Angular, PHP, Static).

### 3. Run Atlas
```bash
# Auto mode (Detects and starts your dev server)
atlas run

# Manual mode (When there's no framework/package.json)
# Atlas will interactively prompt you for the domain and your local server port
atlas run
```

### CLI Options

| Flag                   | Description              | Example                     |
| :--------------------- | :----------------------- | :-------------------------- |
| `-d, --disable <tabs>` | Disable specific UI tabs | `atlas -d console,networks` |
| `-e, --enable <tabs>`  | Re-enable disabled tabs  | `atlas -e console`          |

---

## 🔐 Environment Variables

Atlas can be configured using environment variables. Create a `.env` file in your project root or set them globally. See `.env.example` for a complete list.

| Variable                  | Description                                                                 |
| :------------------------ | :-------------------------------------------------------------------------- |
| `ATLAS_USER_EMAIL`        | Your email (used to filter out your own identity from PII alerts).          |
| `ATLAS_AUTHORIZED_TOKENS` | Comma-separated list of known tokens to ignore in PII scanning.             |
| `ATLAS_STARTUP_TIMEOUT`   | Timeout for auto-detecting the dev server (default: 30000ms).               |
| `PORT`                    | The local port Atlas should proxy to (if not auto-detected).                |
| `ATLAS_DEBUG_PORT`        | CDP Debugging port (default: 9222).                                         |

---

## 🎮 Modes

Atlas automatically detects your project type:

1.  **Auto Mode** (Node.js/NPM Projects):
    *   Detects `package.json` and framework (Next.js, React, Vue, Angular, Express).
    *   Automatically installs dependencies (`npm install`).
    *   Builds the project (supports `build`, `build-client`, `build:all`).
    *   Starts the server (`npm start` or `npm run dev`).
    *   Launches an Electron window in kiosk mode with the mapped domain.

2.  **Manual Mode** (Static / Other Languages):
    *   If no `package.json` is found, Atlas prompts for the **Local Port**.
    *   You must start your server manually (e.g., `python -m http.server`, `go run main.go`).
    *   Atlas proxies the specified port to your custom domain.

---
### 📉 Atlas Dashboard (Project Explorer)
Atlas now features a dedicated **standalone GUI Dashboard** for browsing your projects and reports:
*   **VS Code-style Explorer**: Navigate your projects with a familiar, hierarchical tree structure. Collapsible project nodes and folder icons.
*   **Native Report Viewer**: Open your `atlas-reports` Markdown and JSON files directly within the dashboard.
*   **Live Mermaid Diagrams**: Any Markdown file with ` ```mermaid ` blocks will be rendered as a live, interactive SVG diagram.
*   **Integrated Video Player**: Watch your session recordings (.mp4, .webm) without leaving the Atlas environment.

---

## 🛠️ Features

### 🌐 Domain Masking
Browse your localhost app as if it were on `https://myapp.com`. Atlas intercepts network requests via CDP and proxies them to your local server, solving CORS issues and allowing you to test production-only APIs locally.

### 🎨 Premium Matte Theme
Designed for professional developers, the Atlas UI uses a **Matte Graphite** palette:
*   **No Glow**: Reduced visual strain for long sessions.
*   **Neutral Tones**: Strictly gray backgrounds (#1F1F1F) with emerald accents (#22C55E).
*   **High Contrast**: Neutral off-white text (#CCCCCC) for maximum readability.

### 📉 Report Explorer & Dashboard
Atlas provides a central hub for all your development artifacts:
*   **Hierarchical Tree View**: Browse multiple projects simultaneously.
*   **Mermaid.js Integration**: Live diagram rendering for system architecture or flowcharts.
*   **GFM Support**: High-fidelity Markdown rendering with tables, task lists, and syntax highlighting via `marked.js`.

### 💣 Chaos Engineering (Load Stressor)
Test your app's resilience by injecting failure. Configurable via the UI:

| Setting         | Description                                                 |
| :-------------- | :---------------------------------------------------------- |
| `Error Rate`    | Inject **HTTP 500** responses at a configurable percentage. |
| `Latency Spike` | Add **2s - 5s delay** to a percentage of requests.          |
| `Packet Drop`   | Abort requests mid-flight (simulates spotty Wi-Fi).         |

### 🔌 WebSocket Proxying
Atlas includes a dedicated **WebSocket Proxy** that:
*   Intercepts `Upgrade: websocket` headers and proxies to localhost.
*   Supports chaos injection (dropping frames, delaying messages) on active WebSocket connections.

### 🎥 Session Recording
Records your development session for retrospective debugging:
*   **Video**: High-quality `.mp4` recording of the browser window.
*   **Cursor**: Injects a high-visibility fake cursor for clearer interaction tracking.

### 🏥 Security Warden
The Security Warden actively monitors your app's traffic with a "Zero-Assumption" security model:
*   **Deep PII Scanning**: Uses the Luhn algorithm for **Credit Card** validation and strict structure checks for **JWT Auth Tokens**.
*   **Identity Context Filtration**: Prevents false positives by ignoring your own `ATLAS_USER_EMAIL` and `ATLAS_AUTHORIZED_TOKENS`.
*   **Strict CORS Enforcement**: Blocks responses with `Access-Control-Allow-Origin: *`.
*   **Strict CSP**: The HUD overlay runs under a strict Content Security Policy to prevent XSS.
*   **IPC Validation**: All inter-process communication is validated via **Zod schemas** to prevent injection attacks.

### ⚡ Performance Monitoring
*   Tracks request latency with a **rolling average** per URL path.
*   Flags requests that are **>2x slower** than their average.

### 📊 Auto Journey Report
*   Tracks all navigations with per-page metrics (load time, storage usage).
*   Generates **human-readable Markdown audits** (`atlas-reports/markdown/`).
*   Saves session recording video to `atlas-reports/videos/`.

---

## 🧩 The Atlas UI

Atlas injects a **Shadow DOM overlay** into the browser window with full style isolation:

*   **HUD Bar**: Top bar showing domain mapping, URL, back/forward navigation, minimize, maximize, and close controls.
*   **Floating Pill**: Draggable circular button that opens the expandable tools menu.
*   **Tool Panels** (9 tabs):

| Tab             | Description                                                                          |
| :-------------- | :----------------------------------------------------------------------------------- |
| **Console**     | Intercepted console output with level filters, stack traces, and PII detection       |
| **Networks**    | Chrome DevTools-style request inspector with headers, preview, response, and cookies |
| **Application** | Page metadata, meta tags, scripts, stylesheets, cookies, and storage                 |
| **Storage**     | Page weight analysis, size breakdown, client storage metrics, top 10 resources       |
| **Stability**   | Chaos engineering controls (error rate, latency, drop rate) + live violation monitor |
| **Security**    | Security Warden mode toggle + security violation log                                 |
| **Recorder**    | Start/stop/pause video recording controls                                            |
| **Links**       | Navigation links and route tracking                                                  |
| **Extras**      | Project utilities (force reload, etc.)                                               |

---

## 🏗️ Architecture

Atlas is built with a **layered event-driven architecture**. The Electron shell provides the container, while the Pipeline (typed event bus) serves as the central nervous system connecting all layers.

```text
┌──────────────────────────────────────────────────────────┐
│  Layer 1: CLI Interface (atlas.cmd → atlas.ts)           │
├──────────────────────────────────────────────────────────┤
│  Layer 2: Infrastructure (server.ts, browser.ts)         │
├──────────────────────────────────────────────────────────┤
│  Layer 3: Engine (Brain)                                 │
│  ├─ network-interceptor.ts   CDP proxy + domain masking  │
│  ├─ security-warden.ts       PII scanning + CORS checks  │
│  ├─ performance-tracker.ts   Latency anomaly detection   │
│  ├─ chaos-engine.ts          Load stressor injection     │
│  ├─ session-recorder.ts      Native desktop capture      │
│  ├─ report-manager.ts        Journey reports (JSON + MD) │
│  └─ state.ts                 Centralized definitions     │
├──────────────────────────────────────────────────────────┤
│  Layer 4: Pipeline (pipeline.ts) — Typed Event Bus       │
├──────────────────────────────────────────────────────────┤
│  Layer 5: Electron Shell Architecture                    │
│  ├─ electron-main.ts         App lifecycle & native IPC  │
│  └─ renderer.ts              HUD Overlay (Shadow DOM)    │
├──────────────────────────────────────────────────────────┤
│  Layer 6: UI (9 Dynamic Tool Panels + Drag & Drop Pill)  │
├──────────────────────────────────────────────────────────┤
│  Layer 7: Collectors (link-scanner, storage-metrics)     │
└──────────────────────────────────────────────────────────┘
```

| Component                | Responsibility                                                                |
| :----------------------- | :---------------------------------------------------------------------------- |
| **CLI**                  | Orchestrates env setup, server spawning, process cleanup, tab config          |
| **Server Manager**       | Auto-detect project, install deps, build, spawn server, health check          |
| **Browser Orchestrator** | Launch Electron (kiosk), connect CDP, wire Pipeline, attach all modules       |
| **Network Interceptor**  | CDP request interception, domain proxy, chaos injection, PII/perf scanning    |
| **Security Warden**      | Pure functions for PII regex scanning and CORS header checking                |
| **Performance Tracker**  | Rolling average latency with bounded LRU, anomaly detection                   |
| **Pipeline**             | Typed EventEmitter connecting Engine ↔ Transport ↔ UI (50 max listeners)      |
| **Report Manager**       | In-memory tree-structured journal, periodic flush, Markdown report generation |
| **Session Recorder**     | `puppeteer-screen-recorder` + `ffmpeg` for multi-part video capture           |
| **Transport**            | Shadow DOM injection, WebSocket broadcasting, action routing, static serving  |

---

## 📁 Project Structure

```text
atlas/
├── atlas.ts                     # CLI Commander entry
├── package.json                 # electron-builder & dependencies
├── src/
├── gui/                         # Dashboard React components
│   ├── cli/                     # CLI commands (init/run)
│   ├── server/                  # Project auto-detection
│   ├── browser/                 # Puppeteer orchestrator
│   ├── engine/                  # Core modules (interceptor, chaos, security)
│   ├── pipeline/                # Typed Event Bus
│   ├── collectors/              # Link scanning & storage metrics
│   ├── gui/                     # Standalone Dashboard GUI
│   │   ├── gui-host.html        # Explorer Shell
│   │   ├── gui.css              # Premium Matte Theme
│   │   └── gui-renderer.ts      # Markdown & Mermaid Logic
│   └── electron/                # HUD Overlay Shell
│       ├── electron-main.ts     # Main Process (Recording/IPC)
│       ├── renderer.ts          # HUD Orchestrator
│       ├── index.html           # UI Layout
│       └── ui/                  # Dynamic Tool Components
└── entry.js                     # Electron/CLI packaged router
```

---

## ⚠️ Requirements

*   **FFmpeg** is required for session recording (`choco install ffmpeg` or `brew install ffmpeg`).
*   **Node.js v18+**.

---

## 🛠️ Developer Guide

### How to Run Locally

To contribute to Atlas, follow these steps to set up your local development environment:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/chirag-parmar16/atlas.git
   cd atlas
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # Atlas uses Vite for the UI and tsc for the engine
   ```

3. **Build the project:**
   ```bash
   npm run build
   # This compiles both the UI and the Node.js backend
   ```

4. **Link the CLI for local testing:**
   ```bash
   npm link
   # You can now use the `atlas` command globally, pointing to your local clone
   ```

5. **Run the Sandbox:**
   Navigate to any web project and run `atlas run`. It will use your local modifications!

---

### How to Add a New Tool or Collector

Atlas is designed to be highly modular. Developing a new tool involves two parts: extracting data from the engine/page (Collector) and rendering it in the Electron HUD (Tool).

**Step 1: Create the Data Collector (Backend)**
If your tool requires observing network, DOM, or storage, intercept the data inside `src/browser/browser.ts` or add a new module.
Use the **Pipeline** to broadcast data:
```typescript
pipeline.emit('myNewTool:data', { metrics: 123 });
```

**Step 2: Create the Tool UI Component (Frontend)**
Add a new script file in `src/tools/` (e.g., `my-tool.ts`) and register your tool tab dynamically using `window.Atlas.addTool`:
```typescript
window.Atlas.addTool('My Tool', function() {
    const container = document.createElement('div');
    container.innerHTML = '<h1>My Custom Tool</h1><p id="metrics">Waiting...</p>';
    
    // Listen to data tracked by the engine
    window.addEventListener('myNewTool:data', (e) => {
        container.querySelector('#metrics').innerText = e.detail.metrics;
    });
    
    return container;
}, function onSelect() {
    // Optional: Code to run every time the user clicks this tab
});
```
Make sure to include your new script tag inside `src/electron/index.html`!

---

## 📄 License

MIT © Chirag Parmar
