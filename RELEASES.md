# 🗺️ Atlas v1.0.1 — First Official Release

> The Electron-Powered Standalone Sandbox for Universal Web Development.

We're excited to ship the **first official public release** of Atlas — a standalone, Electron-powered development sandbox that lets you run any web project against a custom domain, with a full suite of professional dev tools built right in.

No plugins. No browser extensions. Just `atlas run`.

---

## 🚀 What is Atlas?

Atlas sits between your localhost and your browser. It acts as a transparent network proxy — intercepting all HTTP/WebSocket traffic via the Chrome DevTools Protocol (CDP) — allowing you to:

- Browse your local app as **`https://yourproductiondomain.com`** without touching your code
- Test against real-world conditions (chaos, latency, packet loss) with a single switch
- Monitor security, performance, and behaviour in real time — all from a sleek HUD overlay

---

## ✨ Features at Launch

### 🌐 Domain Masking
Seamlessly proxy `localhost` to any custom domain. Solve CORS issues, test production-only APIs, and demo your app as if it were live — all without a single DNS change.

### 🖥️ JARVIS-Style HUD Interface
A Chrome-inspired browser shell with:
- **Tab Manager** — Multi-tab browsing with native Chrome-style tabs, favicon, and close buttons
- **HUD Navigation Bar** — Back, Forward, Reload, and URL bar with live domain/port tags
- **Window Controls** — Minimize, Maximize, Close at native system proportions
- **JARVIS Boot Sequence** — Immersive animated loading screen on every startup

### 🛠️ 9 Built-in Devtools Panels

| Panel | What it does |
|---|---|
| **Console** | Intercepted logs with level filters, stack traces, and PII detection |
| **Networks** | DevTools-style request inspector (headers, preview, response, cookies) |
| **Application** | Page metadata, meta tags, scripts, stylesheets, cookies, and storage |
| **Storage** | Page weight, client storage metrics, and top 10 heaviest resources |
| **Stability** | Chaos engineering controls — error rate, latency spikes, packet drops |
| **Security** | Security Warden mode + real-time violation log |
| **Recorder** | Start / pause / stop session video recording |
| **Links** | Route tracking and navigation link inspector |
| **Extras** | Project utilities (force reload, etc.) |

### 💣 Chaos Engineering
Inject production-grade failures directly on your dev server:
- **Error Rate** — HTTP 500 injection at any percentage
- **Latency Spikes** — 2–5s artificial delay on a % of requests
- **Packet Drop** — Mid-flight request aborts to simulate spotty Wi-Fi
- **WebSocket Chaos** — Drop frames and delay messages on live WS connections

### 🔐 Security Warden
Zero-assumption traffic security monitoring:
- **Luhn-algorithm** Credit Card detection
- **JWT Auth Token** leak scanning
- **PII masking** using `first4****last4` standard
- Configurable whitelist via `ATLAS_AUTHORIZED_TOKENS`

### 📊 Auto Journey Reports
- Per-page metrics (load time, storage, navigation path)
- Human-readable **Markdown reports** in `atlas-reports/markdown/`
- Session **video recordings** in `atlas-reports/videos/`

### ⚡ Performance Tracking
- Rolling average latency per URL path
- Automatic flagging of requests **>2× slower** than their baseline

### 📉 Project Dashboard (GUI Explorer)
- VS Code-style project/file tree explorer
- Native Markdown + Mermaid diagram renderer
- Integrated video player for session recordings

---

## 📦 Installation

Download the installer for your platform below:

| Platform | File |
|---|---|
| **Windows** | `Atlas-Sandbox Setup X.X.X.exe` |
| **macOS** | `Atlas-Sandbox-X.X.X.dmg` |
| **Linux** | `Atlas-Sandbox-X.X.X.AppImage` |

> **Requirements**: Node.js v18+ · FFmpeg (for session recording)

### Quick Start
```bash
# 1. Navigate to any web project
cd my-project

# 2. Initialize Atlas (auto-detects your framework)
atlas init myapp.com

# 3. Run
atlas run
```

For full installation and usage docs, visit the [Atlas Documentation Site](https://chirag-parmar16.github.io/atlas/).

---

## 🏗️ Under the Hood

Atlas is built on a **7-layer event-driven architecture**:

```
Layer 1: CLI               atlas run / atlas init
Layer 2: Infrastructure    Server auto-detection & spawning
Layer 3: Engine (Brain)    Interceptor · Security · Chaos · Recorder · Reports
Layer 4: Pipeline          Typed EventEmitter (the central nervous system)
Layer 5: Electron Shell    Main process IPC · Renderer HUD overlay
Layer 6: UI                9 Dynamic tool panels + Tab Manager
Layer 7: Collectors        Link scanner · Storage metrics
```

---

## 🐛 Bug Fixes & Polish (v1.0.1 over internal builds)

- ✅ Fixed HUD bar shadow causing a "white line" artifact on the boot screen
- ✅ Applied 1px overlap strategy to eliminate sub-pixel rendering gaps at all display scaling levels (100%, 125%, 150%)
- ✅ Standardized window control buttons to native Windows proportions (45×32px)
- ✅ Resolved all ESLint CI errors — build pipeline is now fully green across Windows, macOS, and Linux
- ✅ Updated TabManager to use `about:blank` cold-start (prevents 406 errors on Pixy proxy attach)

---

## 📄 License

MIT © [Chirag Parmar](https://github.com/chirag-parmar16)

---

*Built with ❤️ and a lot of `atlas run`.*
