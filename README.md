# 🗺️ Atlas
> **The Chrome-Based Sandbox for Universal Web Development**



Atlas is a powerful **local development sandbox** that launches your web projects in an isolated **Chrome browser window**. It allows you to test your application with **production domain masking**, **network throttling**, **chaos engineering**, and **session recording**—all without deploying a single line of code.

It acts as a "flight simulator" for web developers, letting you fly your app in dangerous conditions (slow network, API failures, strict security) while safely on the ground (localhost).

---

## 🚀 Installation

Atlas is available as a global NPM package.

```bash
npm install -g atlas-sendbox
```

*Note: You need Node.js v18+ installed on your system.*

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

This creates an `atlas.config.json` file in your project directory with default settings:
- Startup timeout: 30 seconds
- Recording: Enabled  
- Debug mode: Disabled

> **Note**: Each project requires its own initialization. You cannot run Atlas without initializing first.

### 3. Run Atlas
```bash
atlas run
```

---

## 📟 CLI Commands

### `atlas init`
Initialize Atlas in the current project directory.

```bash
atlas init
```

**What it does:**
- Creates `atlas.config.json` in your project root
- Sets up default configuration (timeout, recording, debug mode)
- Must be run once per project before using `atlas run`

**Output:**
```
✓ Successfully initialized Atlas!

Created: /path/to/project/atlas.config.json

Default configuration:
  • Startup timeout: 30 seconds
  • Recording: Enabled
  • Debug mode: Disabled

You can now run: atlas run
```

**Note:** If `atlas.config.json` already exists, init will skip creation to avoid overwriting your custom settings.

---

### `atlas run`
Run your project in an isolated Atlas environment.

```bash
atlas run
```

**Prerequisites:**
- Must run `atlas init` first
- Requires `atlas.config.json` in project directory

**Error if not initialized:**
```
[Error] Atlas is not initialized in this project.

Please run: atlas init first to create the configuration file.
```

---

## 🎮 Modes

Atlas automatically detects your project type:

1.  **Auto Mode**: If a `package.json` is detected, Atlas will:
    *   Install dependencies (`npm install`)
    *   Build the project (`npm run build`)
    *   Start the server (`npm start` or `npm run dev`)
    *   Launch a Chrome browser window with the sandbox environment.

2.  **Manual Mode**: If no `package.json` is found, Atlas will:
    *   Prompt you for the **local port** your app is running on.
    *   Serve the directory as a static site if no server is running.

### Configuration Prompts

When you run `atlas run`, you will be asked:
*   **Domain**: What production domain do you want to simulate? (e.g., `myapp.com`)
    *   *Atlas will map this domain to localhost inside the sandbox.*

### Optional Configuration

You can optionally create an `atlas.config.json` file in your project root to customize Atlas behavior:

```json
{
  "startupTimeout": 30000,
  "recordingEnabled": true,
  "debugMode": false
}
```

**Configuration Options**:
- `startupTimeout` (number): Maximum time in milliseconds to wait for server startup. Default: 30000 (30 seconds)
- `recordingEnabled` (boolean): Enable/disable session recording. Default: true
- `debugMode` (boolean): Enable verbose logging. Default: false

**Environment Variables**:
- `ATLAS_STARTUP_TIMEOUT`: Override startup timeout (takes precedence over config file)

Example:
```bash
# Windows PowerShell
$env:ATLAS_STARTUP_TIMEOUT=60000; atlas run

# macOS/Linux
ATLAS_STARTUP_TIMEOUT=60000 atlas run
```

---

## 🛠️ Features

### 🌐 Domain Masking
Browse your localhost app as if it were on `https://google.com` or your own domain. Atlas intercepts network requests and proxies them to your local server, solving CORS issues and allowing you to test production-only APIs locally.

### 🚦 Network Throttling
Simulate real-world connectivity issues directly from the floating UI.

<table>
<tr>
    <th>Profile</th>
    <th>Latency</th>
    <th>Description</th>
</tr>
<tr>
    <td><code>Fast 4G</code></td>
    <td>20ms</td>
    <td>Standard mobile connection simulation</td>
</tr>
<tr>
    <td><code>Slow 4G</code></td>
    <td>100ms</td>
    <td>Poor connectivity simulation</td>
</tr>
<tr>
    <td><code>Offline</code></td>
    <td>Infinity</td>
    <td>Simulates total network loss</td>
</tr>
</table>

### 💣 Chaos Engineering
Test your app's resilience by injecting failure.

<table>
<tr>
    <th>Setting</th>
    <th>Description</th>
    <th>Range</th>
</tr>
<tr>
    <td><code>Error Rate</code></td>
    <td>Randomly fail requests with HTTP 500</td>
    <td>0% - 50%</td>
</tr>
<tr>
    <td><code>Latency Spike</code></td>
    <td>Randomly add 2-5s delay to requests</td>
    <td>0% - 50%</td>
</tr>
<tr>
    <td><code>Packet Drop</code></td>
    <td>Randomly abort requests mid-flight</td>
    <td>0% - 20%</td>
</tr>
</table>

### 🎥 Session Recording
Capture high-definition video of your testing session along with a detailed activity log.
*   **Video**: `session-{timestamp}.mp4` (Full interaction recording)
*   **Report**: `visual-manual-{timestamp}.md` (Markdown log of clicks, navigation, and inputs)

### 🏥 Health & Security
The "Security Warden" module actively monitors your app for violations:
*   **PII Leaks**: Detects emails or credit cards logged to the console.
*   **Strict CORS**: Enforces production-grade CORS policies locally.
*   **Mixed Content**: Warns about insecure HTTP resources.

---

## 🧩 The Atlas UI

Atlas injects a **floating pill** into the bottom-right corner of the browser window. Click it to expand the tool belt.

| Tool        | Description                                                              |
| ----------- | ------------------------------------------------------------------------ |
| **Utils**   | Quick actions like Force Reload and Clear LocalStorage.                  |
| **Logs**    | A secure console that traps logs and highlights sensitive data leaks.    |
| **Audit**   | Inspect DOM elements and view their computed styles and hierarchy.       |
| **Traffic** | Monitor all network requests (API, Assets, Docs) with timing and status. |
| **Record**  | Start/Stop video recording and session logging.                          |
| **Load**    | Simulate multi-user traffic to stress-test your backend.                 |
| **Chaos**   | Configure and enable error/latency injection.                            |

---

## 🏗️ Architecture

Atlas operates by launching a controlled Puppeteer instance that acts as a proxy & supervisor.

<table>
<tr>
    <th>Component</th>
    <th>Responsibility</th>
</tr>
<tr>
    <td><strong>CLI</strong></td>
    <td>Orchestrates the environment setup and process management.</td>
</tr>
<tr>
    <td><strong>Browser</strong></td>
    <td>Headful Puppeteer instance with injected tools and security hooks.</td>
</tr>
<tr>
    <td><strong>Network Manager</strong></td>
    <td>Intercepts all traffic to implement domain masking and throttling.</td>
</tr>
<tr>
    <td><strong>Recorder</strong></td>
    <td>Captures video stream and DOM events for playback/reporting.</td>
</tr>
</table>

---

## 🔌 WebSocket Support

Atlas fully supports **WebSocket interception and proxying**, including real-time chaos engineering and network throttling.

### How It Works
1. **Automatic Detection**: Atlas detects WebSocket upgrade requests and redirects them through a dedicated proxy server.
2. **Transparent Proxying**: WebSocket connections are proxied to your local server while maintaining full bidirectional communication.
3. **Chaos Injection**: Apply packet drops, latency spikes, and connection failures to WebSocket messages in real-time.
4. **Network Throttling**: Simulate slow connections by adding configurable latency to WebSocket message delivery.
5. **Offline Mode**: Properly simulates connection failures by closing WebSocket connections when Offline mode is enabled.

### What Gets Intercepted
- WebSocket handshake requests (`Upgrade: websocket` headers)
- All WebSocket messages (both client → server and server → client)
- Hot Module Replacement (HMR) WebSocket connections from Vite, Webpack, etc.

### Chaos Engineering for WebSockets
When Chaos mode is enabled, the following behaviors apply to WebSocket messages:

| Setting           | Effect                                           |
| ----------------- | ------------------------------------------------ |
| **Packet Drop**   | Randomly drops WebSocket frames without delivery |
| **Latency Spike** | Delays message delivery by 2-5 seconds           |
| **Error Rate**    | Currently applies to HTTP requests only          |

---

## ⚠️ Known Limitations
- **Process Cleanup**: If Atlas crashes, ensure your local server process is stopped manually before restarting.

---

## 📄 License

MIT © Atlas Team
