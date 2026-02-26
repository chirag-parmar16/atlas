# Data Dictionary

Complete reference of all data types, structures, and terminology as defined in the **Atlas README** and **Core Engine**.

---

## 1. Core State Interfaces (`src/engine/state.ts`)

### 1.1 Violation

| Attribute | Type                        | Description                                 |
| --------- | --------------------------- | ------------------------------------------- |
| type      | 'violation' \| 'navigation' | Categorization (optional)                   |
| source    | string                      | Detector (e.g., 'Security Warden', 'Chaos') |
| message   | string                      | Description of the issue                    |
| level     | number                      | 0=INFO, 1=WARN, 2=ERROR                     |
| timestamp | number                      | Unix timestamp                              |
| url       | string                      | Page URL where it occurred                  |
| metadata  | object                      | Optional context (e.g., stack trace)        |

### 1.2 NetworkRequest

| Attribute | Type   | Description                            |
| --------- | ------ | -------------------------------------- |
| id        | string | Unique request ID                      |
| url       | string | Full request URL                       |
| method    | string | HTTP Method (GET, POST, etc.)          |
| status    | number | HTTP Status Code                       |
| type      | string | Resource type (Document, Script, etc.) |
| size      | number | Response size in bytes                 |
| time      | number | Duration in milliseconds               |

---

## 2. Configuration & Features

### 2.1 Chaos Engineering (Load Stressor)

| Setting         | Technical Key | Description                                         |
| :-------------- | :------------ | :-------------------------------------------------- |
| `Error Rate`    | `errorRate`   | Inject **HTTP 500** responses at a percentage.      |
| `Latency Spike` | `latencyRate` | Add **2s - 5s delay** to a percentage of requests.  |
| `Packet Drop`   | `dropRate`    | Abort requests mid-flight (simulates spotty Wi-Fi). |

### 2.2 Security Warden

| Mode       | Responsibility                                                            |
| :--------- | :------------------------------------------------------------------------ |
| `Standard` | Permissive proxying, scans for PII leaks (Emails, CC Cards, JWT) in APIs. |
| `Strict`   | Blocks insecure CORS (`*`) and mixed content in addition to PII scanning. |

---

## 3. UI Components (HUD Overview)

Atlas injects a **Shadow DOM overlay** with the following **9 dynamic tool panels**:

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
| **Extras**      | Project utilities (force reload, project settings)                                   |

---

## 4. Architectural Layers

1.  **CLI Interface**: Orchestrates env setup and server spawning.
2.  **Infrastructure**: Server manager and Puppeteer/CDP orchestrator.
3.  **Engine (Brain)**: Core logic (Interception, Chaos, Warden, Performance).
4.  **Pipeline**: Typed event bus (Central Nervous System).
5.  **Electron Shell**: Standalone container and native IPC handler.
6.  **HUD UI**: Shadow DOM injected overlay.
7.  **Collectors**: Link scanning and storage metric gatherers.
