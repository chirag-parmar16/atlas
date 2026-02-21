# 🗺️ Atlas
> **The Chrome-Based Sandbox for Universal Web Development**

Atlas is a powerful **local development sandbox** that launches your web projects in an isolated **Chrome browser window**. It acts as a transparent proxy between your application and the browser, allowing you to simulate production environments (custom domains, chaos) without modifying your code.

It acts as a "flight simulator" for web developers, letting you fly your app in dangerous conditions (API failures, strict security) while safely on the ground (localhost).

---

## 🚀 Installation

Atlas is available as a global NPM package.

```bash
npm install -g atlas-sandbox
```

*Note: You need Node.js v19+ installed on your system.*

---

## 💻 Usage

Atlas requires initialization before running a project. Follow these steps:

### 1. Navigate to Your Project
```bash
cd /path/to/your/project
```

### 2. Initialize Atlas
```bash
atlas init
```

This creates an `atlas.config.json` file in your project directory.

### 3. Run Atlas
```bash
atlas run
```

---

## 🎮 Modes

Atlas automatically detects your project type:

1.  **Auto Mode** (Node.js/NPM Projects):
    *   Detects `package.json`.
    *   Automatically installs dependencies (`npm install`).
    *   Builds the project (supports `build`, `build-client`, `build:all`).
    *   Starts the server (`npm start` or `npm run dev`).
    *   Launches Chrome with the mapped domain.

2.  **Manual Mode** (Static / Other Languages):
    *   If no `package.json` is found, Atlas prompts for the **Local Port**.
    *   You must start your server manually (e.g., `python -m http.server`, `go run main.go`).
    *   Atlas proxies the specified port to your custom domain.

---

## 🛠️ Features

### 🌐 Domain Masking
Browse your localhost app as if it were on `https://myapp.com` or `https://api.production.local`. Atlas intercepts network requests and proxies them to your local server, solving CORS issues and allowing you to test production-only APIs locally.

### 💣 Load Stressor
Test your app's resilience by injecting failure. Configurable via the UI:

| Setting         | Description                                                  |
| :-------------- | :----------------------------------------------------------- |
| `Latency Spike` | Randomly add **2s - 5s delay** to requests.                  |
| `Packet Drop`   | Randomly abort requests mid-flight (simulates spotty Wi-Fi). |

### 🔌 WebSocket Support
Atlas includes a dedicated **WebSocket Proxy** that:
*   Intercepts `Upgrade: websocket` headers.
*   Supports Load Stressor injection (dropping frames, delaying messages) on active socket connections.

### 🎥 Session Recording
Records your entire development session for retrospective debugging.
*   **Video**: High-quality `.mp4` recording of the browser window.
*   **Cursor**: Injects a high-visibility fake cursor for clearer interaction tracking.
*   **Parts**: Automatically handles long sessions by splitting and merging video parts using `ffmpeg`.

### 🏥 Security Warden
The "Security Warden" module actively monitors your app's traffic:
*   **PII Leaks**: Scans response bodies for **Emails**, **Credit Card Numbers**, and **Auth Tokens** (JWT, AWS Keys).
*   **Strict CORS**: Blocks responses with `Access-Control-Allow-Origin: *` to enforce production security standards.
*   **Performance Monitoring**: Flags requests that are >2x slower than their rolling average (>250ms).

---

## 🧩 The Atlas UI

Atlas injects a **floating pill** into the bottom-right corner of the browser window.
*   **Heads-Up Display (HUD)**: Shows current status.
*   **Controls**: Toggle Stressor and Recording instantly.
*   **Violations**: Real-time alerts for Security and Performance issues.

---

## 🏗️ Architecture

Atlas operates by launching a controlled **Puppeteer** instance that acts as a proxy & supervisor.

| Component           | Responsibility                                                                |
| :------------------ | :---------------------------------------------------------------------------- |
| **CLI**             | Orchestrates env setup, server spawning (`npm run dev`), and process cleanup. |
| **Network Manager** | Intercepts HTTP/WS traffic, applies stress, and proxies to localhost.         |
| **Security Warden** | Regular Expression engine for PII scanning and Header analysis.               |
| **Recorder**        | Uses `puppeteer-screen-recorder` and `ffmpeg` to capture session video.       |

---

## ⚠️ Requirements

*   **Google Chrome** must be installed.
*   **FFmpeg** is required for session recording (`choco install ffmpeg` or `brew install ffmpeg`).
*   **Node.js v18+**.

---

## 📄 License

MIT © Atlas Team
