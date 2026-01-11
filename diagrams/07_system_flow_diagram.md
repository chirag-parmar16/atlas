# System Flow Diagram

Comprehensive view of the Atlas system architecture, component relationships, and data flows.

---

## 1. High-Level Architecture

```mermaid
flowchart TB
    subgraph Layer1["Layer 1: CLI Interface"]
        ENTRY["atlas.ts<br/>Entry Point"]
        RUN["run.ts<br/>Command Handler"]
    end

    subgraph Layer2["Layer 2: Backend Services"]
        SRV["server.ts<br/>Server Manager"]
        BRW["browser.ts<br/>Browser Orchestrator"]
    end

    subgraph Layer3["Layer 3: Browser Runtime"]
        PUP["Puppeteer<br/>Browser Instance"]
        NET["network-manager.ts<br/>Request Interceptor"]
        REC["session-recorder.ts<br/>Video Capture"]
    end

    subgraph Layer4["Layer 4: User Interface"]
        SHELL["Atlas Shell<br/>Parent Frame"]
        IFRAME["Project App<br/>Child Frame"]
        TOOLS["Tool Panels<br/>Floating UI"]
    end

    subgraph Layer5["Layer 5: External"]
        FS[("File System")]
        PROC["Project Process"]
    end

    ENTRY --> RUN
    RUN --> SRV
    RUN --> BRW
    SRV --> PROC
    BRW --> PUP
    PUP --> NET
    PUP --> REC
    NET --> SHELL
    SHELL --> IFRAME
    BRW --> TOOLS
    PROC --> NET
    REC --> FS
```

---

## 2. Request Processing Flow

```mermaid
flowchart TD
    A["Incoming Request"] --> B{"Frame Type?"}
    
    B -->|"Main Frame"| C{"URL Domain?"}
    C -->|"Matches Target"| D["Serve Atlas Shell HTML"]
    C -->|"Different Domain"| E["Block Navigation"]
    
    B -->|"Child Frame / Subresource"| F{"Throttling Profile?"}
    
    F -->|"Offline"| G["Abort Request"]
    F -->|"Online"| H{"Chaos Enabled?"}
    
    H -->|"Yes"| I{"Random Check"}
    I -->|"Drop Rate Hit"| G
    I -->|"Error Rate Hit"| J["Return 500 Error"]
    I -->|"Latency Rate Hit"| K["Add 2-5s Delay"]
    I -->|"Pass"| L["Continue"]
    K --> L
    
    H -->|"No"| L
    
    L --> M{"Throttling Latency?"}
    M -->|"Slow 4G"| N["Add 100ms"]
    M -->|"Fast 4G"| O["Add 20ms"]
    M -->|"None"| P["No Delay"]
    N --> Q
    O --> Q
    P --> Q
    
    Q["Proxy to Localhost"]
    Q --> R["Fetch from Project Server"]
    R --> S{"Response OK?"}
    
    S -->|"Yes"| T["Strip Security Headers"]
    S -->|"Error"| U["Log Violation"]
    U --> T
    
    T --> V["Log to Traffic Panel"]
    V --> W["Return Response"]
    
    D --> W
    E --> X["Abort"]
    J --> W
```

---

## 3. Session Recording Flow

```mermaid
flowchart LR
    subgraph Trigger["Recording Trigger"]
        A["User Clicks Start"]
    end
    
    subgraph Capture["Capture Phase"]
        B["PuppeteerScreenRecorder.start()"]
        C["Video Frames Captured"]
        D["User Interactions Logged"]
    end
    
    subgraph Events["Event Types"]
        E1["Navigation Events"]
        E2["Click Actions"]
        E3["Input Changes"]
        E4["Errors"]
        E5["API Calls"]
    end
    
    subgraph Output["Output Generation"]
        F["recorder.stop()"]
        G["Write MP4 File"]
        H["Generate Markdown"]
    end
    
    subgraph Files["Output Files"]
        I["session-*.mp4"]
        J["visual-manual-*.md"]
    end
    
    A --> B
    B --> C
    B --> D
    
    D --> E1
    D --> E2
    D --> E3
    D --> E4
    D --> E5
    
    C --> F
    E1 --> F
    E2 --> F
    E3 --> F
    E4 --> F
    E5 --> F
    
    F --> G
    F --> H
    
    G --> I
    H --> J
```

---

## 4. Tool Panel Architecture

```mermaid
flowchart TB
    subgraph Shell["Atlas Shell (Shadow DOM)"]
        HOST["#atlas-tools-host"]
        PILL["Floating Pill Button"]
        MENU["Expandable Menu"]
    end
    
    subgraph Tabs["Tool Tabs"]
        T1["Utils"]
        T2["Logs"]
        T3["Audit"]
        T4["Traffic"]
        T5["Record"]
        T6["Load"]
        T7["Health"]
        T8["Chaos"]
    end
    
    subgraph APIs["Backend Bridges"]
        A1["page.exposeFunction"]
        A2["window.Atlas API"]
        A3["Custom Events"]
    end
    
    HOST --> PILL
    HOST --> MENU
    
    MENU --> T1
    MENU --> T2
    MENU --> T3
    MENU --> T4
    MENU --> T5
    MENU --> T6
    MENU --> T7
    MENU --> T8
    
    T1 --> A2
    T2 --> A2
    T2 --> A3
    T3 --> A2
    T4 --> A2
    T4 --> A3
    T5 --> A1
    T6 --> A1
    T7 --> A2
    T8 --> A1
```

---

## 5. Multi-User Load Test Flow

```mermaid
flowchart TD
    subgraph Browser["Browser Context"]
        A["User Enters Count"]
        B["Click Launch Traffic"]
        C["Call startTrafficSim()"]
    end
    
    subgraph Node["Node.js Context"]
        D["Receive URL + Count"]
        E["Create HTTP Agent"]
        F["Rewrite URL to Localhost"]
        G["Fire N Concurrent Requests"]
    end
    
    subgraph Server["Project Server"]
        H["Handle Requests"]
        I["Return Responses"]
    end
    
    subgraph Results["Result Processing"]
        J["Count Success/Fail"]
        K["Emit Progress Event"]
        L["Update UI Stats"]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    H --> I
    I --> J
    J --> K
    K --> L
    L --> B
```

---

## 6. Security Violation Detection Flow

```mermaid
flowchart TD
    subgraph Sources["Detection Sources"]
        S1["Console Output"]
        S2["Network Requests"]
        S3["Promise Rejections"]
        S4["Window Errors"]
    end
    
    subgraph Checks["Security Checks"]
        C1["Email Pattern Check"]
        C2["Credit Card Check"]
        C3["Secret Key Check"]
        C4["Mixed Content Check"]
        C5["CORS Wildcard Check"]
        C6["HTTP Error Check"]
    end
    
    subgraph Detection["Violation Handler"]
        D["Atlas.reportViolation()"]
    end
    
    subgraph State["State Management"]
        E["Add to violations array"]
        F["Dispatch atlas-violation event"]
        G["Update Status Indicator"]
    end
    
    subgraph UI["Health Panel"]
        H["Display Violation List"]
    end
    
    S1 --> C1
    S1 --> C2
    S1 --> C3
    S2 --> C4
    S2 --> C5
    S2 --> C6
    S3 --> D
    S4 --> D
    
    C1 --> D
    C2 --> D
    C3 --> D
    C4 --> D
    C5 --> D
    C6 --> D
    
    D --> E
    E --> F
    F --> G
    F --> H
```

---

## 7. Component Communication Matrix

| From                | To                  | Mechanism             | Data                        |
| ------------------- | ------------------- | --------------------- | --------------------------- |
| CLI                 | ServerManager       | Function call         | projectPath, onLog callback |
| CLI                 | BrowserOrchestrator | Function call         | domain, port, projectPath   |
| ServerManager       | ProjectProcess      | child_process.spawn   | npm commands                |
| BrowserOrchestrator | Puppeteer           | Puppeteer API         | Launch options              |
| BrowserOrchestrator | NetworkManager      | Constructor           | Page, NetworkConfig         |
| BrowserOrchestrator | SessionRecorder     | Constructor           | Page, RecorderConfig        |
| NetworkManager      | ProjectProcess      | Node fetch()          | HTTP requests               |
| NetworkManager      | AtlasUI             | page.evaluate()       | Request logs                |
| SessionRecorder     | FileSystem          | fs.writeFile()        | MP4, Markdown               |
| AtlasUI             | NetworkManager      | exposeFunction bridge | Config changes              |
| AtlasUI             | SessionRecorder     | exposeFunction bridge | Recording commands          |
| ProjectIframe       | AtlasUI             | postMessage           | Console logs, URL changes   |

---

## 8. Startup Sequence Timeline

```mermaid
gantt
    title Atlas Startup Timeline
    dateFormat X
    axisFormat %s
    
    section CLI
    Parse Command           :0, 1
    Validate Project        :1, 2
    
    section Server
    npm install             :2, 5
    npm build               :5, 8
    Find Port               :8, 9
    npm start               :9, 12
    Health Check            :12, 15
    
    section Browser
    Launch Puppeteer        :15, 17
    Setup NetworkManager    :17, 18
    Setup Recorder          :18, 19
    Inject Tools            :19, 20
    Navigate to Domain      :20, 22
    
    section UI
    Create Shadow DOM       :22, 23
    Render Pill             :23, 24
    Register Tools          :24, 25
    Ready                   :25, 26
```

---

## 9. Error Handling Paths

| Component           | Error Type             | Handling       | User Feedback       |
| ------------------- | ---------------------- | -------------- | ------------------- |
| ServerManager       | npm install fails      | Reject promise | Console error, exit |
| ServerManager       | npm build fails        | Reject promise | Console error, exit |
| ServerManager       | Server won't start     | 30s timeout    | Proceed anyway      |
| BrowserOrchestrator | Puppeteer launch fails | Throw error    | Console error, exit |
| NetworkManager      | Proxy request fails    | Abort request  | Connection refused  |
| SessionRecorder     | Recording start fails  | Return false   | UI shows failure    |
| AtlasUI             | Tool render error      | try/catch      | Console error       |
