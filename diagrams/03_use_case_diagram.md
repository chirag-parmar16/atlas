# Use Case Diagram

This diagram presents Atlas as a **"Flight Simulator for Web Developers"**, as described in the README. It illustrates the role of the 9 integrated Tool Panels in monitoring and controlling the flight.

```mermaid
use_case_diagram
    rect "Atlas Sandbox (The Flight Simulator)"
        (Initialize Flight Environment)
        (Simulate Production Domain)
        (Stability Stress Testing)
        (Security Warden Audit)
        (Performance & Storage Analysis)
        (Retrospective Recording)
        (Project Utilities & Extras)
    end

    Developer --> (Initialize Flight Environment)
    Developer --> (Simulate Production Domain)
    Developer --> (Stability Stress Testing)
    Developer --> (Security Warden Audit)
    Developer --> (Performance & Storage Analysis)
    Developer --> (Retrospective Recording)
    Developer --> (Project Utilities & Extras)

    (Stability Stress Testing) ..> (Inject Chaos: 500s/Latency/Drop) : includes
    (Security Warden Audit) ..> (Detect PII Leaks & CORS) : includes
    (Retrospective Recording) ..> (Multi-part Video Merge) : includes
    (Performance & Storage Analysis) ..> (DOM/Cookie/Resource Tracking) : includes
```

## Tool Panel Mapping (The 9 HUD Tabs)

| HUD Tab         | Use Case Category    | README Feature Mapping                                   |
| :-------------- | :------------------- | :------------------------------------------------------- |
| **Console**     | System Health        | Intercepted console output with stack traces.            |
| **Networks**    | System Health        | DevTools-style request/response inspector.               |
| **Application** | System Health        | Meta tags, scripts, and document structure.              |
| **Storage**     | Performance Analysis | Client-side storage (Cookies/Local) and resource weight. |
| **Stability**   | Stability Testing    | Chaos Engineering controls (Error/Latency/Drop).         |
| **Security**    | Security Audit       | Security Warden toggle and leak detection log.           |
| **Recorder**    | Retrospective        | Native MP4 video session recording.                      |
| **Links**       | Navigation           | Route tracking and link scanning.                        |
| **Extras**      | Project Utilities    | Force reload and advanced developer options.             |
