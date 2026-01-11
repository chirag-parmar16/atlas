# Use Case Diagram

This diagram illustrates all use cases available in the Atlas system organized by functional area.

```mermaid
flowchart TB
    subgraph Actors["Actors"]
        DEV(("Developer"))
        SYS(("System"))
    end

    subgraph ATLAS["ATLAS SYSTEM"]
        
        subgraph Initialization["Session Initialization"]
            UC01["UC01: Start Atlas Session"]
            UC02["UC02: Configure Domain"]
            UC03["UC03: Auto-Detect Project Type"]
        end
        
        subgraph Sandbox["Sandboxed Browsing"]
            UC04["UC04: Browse with Domain Masking"]
            UC05["UC05: Navigate Project Routes"]
            UC06["UC06: View in Isolated Environment"]
        end
        
        subgraph Monitoring["Monitoring & Debugging"]
            UC07["UC07: Monitor Network Traffic"]
            UC08["UC08: View Console Logs"]
            UC09["UC09: Inspect DOM Elements"]
            UC10["UC10: Detect Security Violations"]
        end
        
        subgraph Testing["Testing Tools"]
            UC11["UC11: Simulate Network Conditions"]
            UC12["UC12: Inject Chaos Failures"]
            UC13["UC13: Generate Multi-User Load"]
        end
        
        subgraph Recording["Session Recording"]
            UC14["UC14: Start Video Recording"]
            UC15["UC15: Stop Video Recording"]
            UC16["UC16: Capture User Interactions"]
        end
        
        subgraph Output["Output Generation"]
            UC17["UC17: Generate MP4 Video"]
            UC18["UC18: Generate Visual Manual"]
        end
        
        subgraph Utilities["Utility Functions"]
            UC19["UC19: Reload Project"]
            UC20["UC20: Clear Storage"]
            UC21["UC21: Toggle Security Mode"]
        end
    end

    %% Developer initiated use cases
    DEV --> UC01
    DEV --> UC02
    DEV --> UC04
    DEV --> UC05
    DEV --> UC07
    DEV --> UC08
    DEV --> UC09
    DEV --> UC11
    DEV --> UC12
    DEV --> UC13
    DEV --> UC14
    DEV --> UC15
    DEV --> UC19
    DEV --> UC20
    DEV --> UC21
    
    %% System automated use cases
    SYS --> UC03
    SYS --> UC06
    SYS --> UC10
    SYS --> UC16
    SYS --> UC17
    SYS --> UC18
    
    %% Dependencies
    UC01 --> UC03
    UC14 --> UC16
    UC15 --> UC17
    UC15 --> UC18
```

## Use Case Specifications

### Session Initialization

| UC ID | Use Case                 | Actor     | Description                            | Precondition   | Postcondition     |
| ----- | ------------------------ | --------- | -------------------------------------- | -------------- | ----------------- |
| UC01  | Start Atlas Session      | Developer | Execute atlas run in project directory | Project exists | Browser launched  |
| UC02  | Configure Domain         | Developer | Enter production domain to simulate    | UC01 complete  | Domain configured |
| UC03  | Auto-Detect Project Type | System    | Check for package.json                 | UC01 triggered | Mode selected     |

### Sandboxed Browsing

| UC ID | Use Case                     | Actor     | Description                       | Precondition   | Postcondition    |
| ----- | ---------------------------- | --------- | --------------------------------- | -------------- | ---------------- |
| UC04  | Browse with Domain Masking   | Developer | Access project via production URL | Session active | Page displayed   |
| UC05  | Navigate Project Routes      | Developer | Visit different pages/routes      | UC04 complete  | Route loaded     |
| UC06  | View in Isolated Environment | System    | Render project in iframe sandbox  | Browser ready  | Isolation active |

### Monitoring & Debugging

| UC ID | Use Case                   | Actor     | Description                       | Precondition   | Postcondition       |
| ----- | -------------------------- | --------- | --------------------------------- | -------------- | ------------------- |
| UC07  | Monitor Network Traffic    | Developer | View all HTTP requests/responses  | Session active | Traffic logged      |
| UC08  | View Console Logs          | Developer | See console.log/warn/error output | Session active | Logs displayed      |
| UC09  | Inspect DOM Elements       | Developer | Analyze page structure and styles | Session active | Element selected    |
| UC10  | Detect Security Violations | System    | Identify PII leaks, CORS issues   | Session active | Violations reported |

### Testing Tools

| UC ID | Use Case                    | Actor     | Description                    | Precondition   | Postcondition      |
| ----- | --------------------------- | --------- | ------------------------------ | -------------- | ------------------ |
| UC11  | Simulate Network Conditions | Developer | Apply throttling (4G, Offline) | Session active | Throttling applied |
| UC12  | Inject Chaos Failures       | Developer | Add errors, latency, drops     | Session active | Chaos active       |
| UC13  | Generate Multi-User Load    | Developer | Simulate concurrent requests   | Session active | Load test complete |

### Session Recording

| UC ID | Use Case                  | Actor     | Description                    | Precondition     | Postcondition     |
| ----- | ------------------------- | --------- | ------------------------------ | ---------------- | ----------------- |
| UC14  | Start Video Recording     | Developer | Begin screen capture           | Session active   | Recording started |
| UC15  | Stop Video Recording      | Developer | End screen capture             | UC14 active      | Recording stopped |
| UC16  | Capture User Interactions | System    | Log clicks, inputs, navigation | Recording active | Events captured   |

### Output Generation

| UC ID | Use Case               | Actor  | Description                   | Precondition   | Postcondition |
| ----- | ---------------------- | ------ | ----------------------------- | -------------- | ------------- |
| UC17  | Generate MP4 Video     | System | Save recording to file        | UC15 triggered | MP4 created   |
| UC18  | Generate Visual Manual | System | Create markdown documentation | UC15 triggered | MD created    |

### Utility Functions

| UC ID | Use Case             | Actor     | Description                 | Precondition   | Postcondition   |
| ----- | -------------------- | --------- | --------------------------- | -------------- | --------------- |
| UC19  | Reload Project       | Developer | Refresh iframe content      | Session active | Page reloaded   |
| UC20  | Clear Storage        | Developer | Remove localStorage/cookies | Session active | Storage cleared |
| UC21  | Toggle Security Mode | Developer | Switch Standard/Strict CORS | Session active | Mode changed    |
