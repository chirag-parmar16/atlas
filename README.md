# 🗺️ Atlas
> **The Browser Sandbox for Universal Web Development**

<style>
table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
}
th {
    background: #1e3a5f;
    color: #fff;
    padding: 12px 8px;
    text-align: left;
    border: 1px solid #2d4a6f;
}
td {
    padding: 10px 8px;
    border: 1px solid #333;
    color: #e0e0e0;
}
tr:nth-child(odd) td {
    background: #1a1a2e;
}
tr:nth-child(even) td {
    background: #16213e;
}
code {
    background: rgba(255,255,255,0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    color: #ff9e64;
}
</style>

Atlas is a powerful **local development sandbox** that creates an isolated browser environment for your web projects. It allows you to test your application with **production domain masking**, **network throttling**, **chaos engineering**, and **session recording**—all without deploying a single line of code.

It acts as a "flight simulator" for web developers, letting you fly your app in dangerous conditions (slow network, API failures, strict security) while safely on the ground (localhost).

---

## 🚀 Installation

Atlas is available as a global NPM package.

```bash
npm install -g atlas-cli
```

*Note: You need Node.js v18+ installed on your system.*

---

## 💻 Usage

Navigate to your project directory and run:

```bash
atlas run
```

### Modes

Atlas automatically detects your project type:

1.  **Auto Mode**: If a `package.json` is detected, Atlas will:
    *   Install dependencies (`npm install`)
    *   Build the project (`npm run build`)
    *   Start the server (`npm start` or `npm run dev`)
    *   Launch the sandbox on the detected port.

2.  **Manual Mode**: If no `package.json` is found, Atlas will:
    *   Prompt you for the **local port** your app is running on.
    *   Serve the directory as a static site if no server is running.

### Configuration Prompts

When you run `atlas run`, you will be asked:
*   **Domain**: What production domain do you want to simulate? (e.g., `myapp.com`)
    *   *Atlas will map this domain to localhost inside the sandbox.*

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

Atlas injects a **floating pill** into the bottom-left corner of your browser. Click it to expand the tool belt.

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

## 📄 License

MIT © Atlas Team
