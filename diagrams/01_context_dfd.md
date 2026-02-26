# Context Level Data Flow Diagram (DFD)

This diagram represents the highest level view of the Atlas system, showing the main external entities and data flows based on the Electron-based architecture.

```mermaid
flowchart TB
    subgraph External_Entities["External Entities"]
        direction TB
        DEV(("Developer"))
        FS[("File System")]
        PROD(("Production Domain"))
    end

    subgraph ATLAS_SYSTEM["ATLAS SYSTEM"]
        direction TB
        
        subgraph CLI_Layer["CLI Layer"]
            INIT["Atlas Init"]
            RUN["Atlas Run"]
        end
        
        subgraph Electron_Host["Electron Host (HUD)"]
            MAIN["Main Process"]
            UI["Renderer (HUD UI)"]
            TAB["Tab Manager"]
        end

        subgraph Engine_Pipeline["Engine & Pipeline"]
            NET["Network Interceptor"]
            STRESS["Stressor"]
            SEC["Security Scanner"]
            PIPE["Central Pipeline (Events)"]
        end

        subgraph Browser_Guest["Browser Guest"]
            PAGE["Puppeteer Page"]
            API["Global Atlas API"]
        end
    end

    %% Input Flows
    DEV -->|"1. Command"| INIT
    DEV -->|"1. Command"| RUN
    INIT -->|"12. Create Config"| FS
    FS -->|"2. atlas.config.json"| RUN
    RUN -->|"3. Spawn"| MAIN
    FS <-->|"2. Source Code"| MAIN
    FS <-->|"11. Reports/Logs"| MAIN
    
    %% Internal Flows
    MAIN -->|"4. Attach"| Browser_Guest
    PAGE <--> API
    PAGE -->|"5. Logic"| NET
    STRESS -->|"8. Interference"| NET
    NET -->|"6. Events"| PIPE
    PIPE -->|"7. Sync Data"| UI
    
    %% External Communication
    NET <-->|"9. Domain Masking"| PROD
    
    %% Output Flows
    UI -->|"10. HUD Dashboard"| DEV
```

## Data Flow Descriptions

| #   | Flow            | Source              | Destination         | Data                               |
| --- | --------------- | ------------------- | ------------------- | ---------------------------------- |
| 1   | Command         | Developer           | CLI Layer           | CLI Execution (init, run)          |
| 2   | Source / Config | File System         | CLI / Main          | Project assets & atlas.config.json |
| 3   | Spawn           | Atlas Run           | Main Process        | Launch Electron Host               |
| 4   | Attach          | Main Process        | Browser Guest       | CDP connection and instrumentation |
| 5   | Logic           | Puppeteer Page      | Network Interceptor | HTTP/WS Traffic                    |
| 6   | Events          | Network Interceptor | Central Pipeline    | Intercepted events & violations    |
| 7   | Sync Data       | Central Pipeline    | Renderer (HUD UI)   | Live data feed to UI               |
| 8   | Interference    | Stressor            | Network Interceptor | Injected latency/errors            |
| 9   | Domain Masking  | Network Interceptor | Production Domain   | Proxied traffic                    |
| 10  | HUD Dashboard   | Renderer (HUD UI)   | Developer           | Interactive visual interface       |
| 11  | Reports/Logs    | Main Process        | File System         | Persisted audit results            |
| 12  | Create Config   | Atlas Init          | File System         | atlas.config.json                  |

## Process Descriptions

| Process             | Description                                                                       |
| ------------------- | --------------------------------------------------------------------------------- |
| CLI Layer           | Handles project initialization and session startup via the terminal.              |
| Electron Host (HUD) | Provides the native container, window management, and the visual dashboard.       |
| Engine & Pipeline   | Core analytical layer that processes traffic, applies security, and emits events. |
| Browser Guest       | The isolated web environment where the target application runs.                   |
| Stressor            | Module formerly known as Chaos Engine; responsible for stability testing.         |
| Network Interceptor | Intercepts all traffic for proxying and analysis.                                 |
