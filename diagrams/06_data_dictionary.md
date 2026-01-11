# Data Dictionary

Complete reference of all data types, structures, interfaces, and constants in the Atlas system.

---

## 1. Configuration Interfaces

### 1.1 NetworkConfig

| Attribute | Type   | Required | Default | Description                   |
| --------- | ------ | -------- | ------- | ----------------------------- |
| domain    | string | Yes      | -       | Production domain to mask     |
| localPort | number | Yes      | -       | Local server port to proxy to |

### 1.2 RecorderConfig

| Attribute   | Type   | Required | Default | Description                   |
| ----------- | ------ | -------- | ------- | ----------------------------- |
| projectPath | string | Yes      | -       | Absolute path to project root |

### 1.3 ChaosConfig

| Attribute   | Type    | Required | Default | Range | Description                    |
| ----------- | ------- | -------- | ------- | ----- | ------------------------------ |
| enabled     | boolean | Yes      | false   | -     | Master toggle for chaos mode   |
| errorRate   | number  | Yes      | 0       | 0-50  | Percentage returning HTTP 500  |
| latencyRate | number  | Yes      | 0       | 0-50  | Percentage with 2-5s delay     |
| dropRate    | number  | Yes      | 0       | 0-20  | Percentage of dropped requests |

---

## 2. Result Types

### 2.1 ServerResult

| Attribute | Type         | Nullable | Description                  |
| --------- | ------------ | -------- | ---------------------------- |
| port      | number       | No       | Assigned server port number  |
| child     | ChildProcess | Yes      | Node.js child process handle |
| cleanup   | Function     | No       | Function to terminate server |

### 2.2 BrowserResult

| Attribute    | Type         | Description               |
| ------------ | ------------ | ------------------------- |
| broadcastLog | Function     | Send log messages to UI   |
| close        | Function     | Close browser and cleanup |
| process      | ChildProcess | Browser process handle    |

---

## 3. Network Data Structures

### 3.1 NetworkRequestLog

| Attribute  | Type   | Description           | Example               |
| ---------- | ------ | --------------------- | --------------------- |
| id         | string | Unique request ID     | x7k2m9                |
| url        | string | Full request URL      | https://myapp.com/api |
| method     | string | HTTP method           | GET, POST             |
| status     | number | Response status code  | 200, 404              |
| type       | string | Inferred content type | Doc, API, Script      |
| time       | number | Duration in ms        | 42                    |
| reqHeaders | object | Request headers       | Content-Type          |
| resHeaders | object | Response headers      | X-Forwarded-Proto     |
| body       | string | Response body         | JSON data             |

### 3.2 Content Type Inference

| Inferred Type | Detection Method             |
| ------------- | ---------------------------- |
| Doc           | content-type contains html   |
| API           | content-type contains json   |
| Script        | url ends with .js            |
| CSS           | url ends with .css           |
| Img           | url ends with .png/.jpg/.svg |
| Other         | Default fallback             |

---

## 4. Session Event Types

### 4.1 SessionEvent

| Attribute | Type   | Description        | Example    |
| --------- | ------ | ------------------ | ---------- |
| time      | string | ISO timestamp      | 14:32:15   |
| url       | string | Current page path  | /dashboard |
| type      | string | Event category     | ACTION     |
| details   | any    | Type-specific data | See below  |

### 4.2 EventType Enumeration

| Value      | Trigger             | Details Schema               |
| ---------- | ------------------- | ---------------------------- |
| NAVIGATION | pushState, popstate | string description           |
| ACTION     | Click event         | tag, label, id, className    |
| INPUT      | Form field change   | tag, inputType, label, value |
| ERROR      | Window error        | error message string         |
| API_ERROR  | Fetch failure       | status and URL               |

---

## 5. Violation Tracking

### 5.1 Violation

| Attribute | Type   | Description           | Example             |
| --------- | ------ | --------------------- | ------------------- |
| source    | string | Detector module       | Console             |
| message   | string | Violation description | Email leak detected |
| level     | number | Severity level        | 2                   |
| timestamp | number | Unix timestamp        | 1704931200000       |

### 5.2 SeverityLevel Enumeration

| Value | Name  | Color  | Use Case              |
| ----- | ----- | ------ | --------------------- |
| 0     | INFO  | Gray   | Informational notices |
| 1     | WARN  | Yellow | Warnings              |
| 2     | ERROR | Red    | Critical issues       |

### 5.3 Violation Detection Rules

| Source          | Trigger              | Severity |
| --------------- | -------------------- | -------- |
| Console         | console.error called | ERROR    |
| Promise         | Unhandled rejection  | WARN     |
| Data Leak       | Email regex match    | ERROR    |
| Data Leak       | Credit card pattern  | ERROR    |
| Security Warden | Mixed content        | WARN     |
| Security Warden | CORS wildcard        | ERROR    |
| Traffic         | HTTP status 500+     | ERROR    |
| Traffic         | HTTP status 400-499  | WARN     |

---

## 6. Atlas Global API

### 6.1 window.Atlas

| Member            | Type     | Description             |
| ----------------- | -------- | ----------------------- |
| Severity          | object   | SeverityLevel enum      |
| addTool           | function | Register new tool panel |
| reportViolation   | function | Log a violation         |
| setRecordingState | function | Update UI indicator     |
| logNetworkRequest | function | Add to Traffic panel    |

### 6.2 Tool Registration

| Parameter | Type     | Description           |
| --------- | -------- | --------------------- |
| name      | string   | Tab label text        |
| renderFn  | Function | Returns panel content |
| onShowFn  | Function | Callback when shown   |

---

## 7. Exposed Node.js Functions

| Function            | Parameters          | Returns | Purpose                   |
| ------------------- | ------------------- | ------- | ------------------------- |
| setThrottling       | profile: string     | void    | Change throttling profile |
| setSecurityMode     | mode: string        | void    | Toggle CORS mode          |
| setChaosConfig      | config: ChaosConfig | void    | Update chaos settings     |
| startTrafficSim     | url, count          | Promise | Execute load test         |
| atlasStartRecording | none                | Promise | Begin video capture       |
| atlasStopRecording  | none                | Promise | End capture               |
| atlasRecordEvent    | event               | void    | Log interaction           |

---

## 8. Throttling Profiles

| Profile Name  | Latency | Behavior             |
| ------------- | ------- | -------------------- |
| No Throttling | 0ms     | Default, no delay    |
| Fast 4G       | 20ms    | Fast mobile          |
| Slow 4G       | 100ms   | Slow mobile          |
| Offline       | N/A     | All requests aborted |

---

## 9. Security Modes

| Mode     | CORS Wildcards | Mixed Content | Description     |
| -------- | -------------- | ------------- | --------------- |
| Standard | Allowed        | Warning only  | Permissive      |
| Strict   | Blocked        | Blocked       | Production-like |

---

## 10. File Output Formats

### 10.1 Video Recording

| Attribute | Value                   |
| --------- | ----------------------- |
| Format    | MP4                     |
| Filename  | session-{timestamp}.mp4 |
| Location  | Project root            |

### 10.2 Visual Manual

| Attribute | Value                            |
| --------- | -------------------------------- |
| Format    | Markdown                         |
| Filename  | visual-manual-{timestamp}.md     |
| Location  | Project root                     |
| Sections  | Header, Video link, Activity Log |
