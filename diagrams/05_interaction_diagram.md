# Interaction Diagram (Sequence Diagram)

This diagram shows the complete sequence of interactions when a developer executes `atlas run`.

```mermaid
sequenceDiagram
    autonumber
    
    actor DEV as Developer
    participant CLI as AtlasCLI
    participant RUN as RunCommand
    participant SRV as ServerManager
    participant PROC as ProjectProcess
    participant BRW as BrowserOrchestrator
    participant PUP as PuppeteerBrowser
    participant NET as NetworkManager
    participant REC as SessionRecorder
    participant UI as AtlasUIShell
    
    Note over DEV,UI: Phase 1: Initialization
    
    DEV->>CLI: atlas run
    CLI->>RUN: run()
    RUN->>RUN: projectPath = process.cwd()
    RUN->>RUN: projectName = path.basename()
    
    Note over RUN: Check project type
    
    alt Has package.json [Auto Mode]
        RUN->>SRV: startServer(projectPath, onLog)
        
        Note over SRV: Build Pipeline
        
        opt Missing node_modules
            SRV->>PROC: npm install
            PROC-->>SRV: Dependencies installed
        end
        
        opt Has build script
            SRV->>PROC: npm run build
            PROC-->>SRV: Build complete
        end
        
        SRV->>SRV: findFreePort()
        SRV->>PROC: npm start [PORT=xxxx]
        
        loop Health Check (every 500ms)
            SRV->>PROC: HTTP GET localhost:port
            PROC-->>SRV: Response
        end
        
        SRV-->>RUN: ServerResult {port, child, cleanup}
        
    else No package.json [Manual Mode]
        RUN->>DEV: Prompt: Enter port number
        DEV-->>RUN: Port (e.g., 8000)
        RUN->>PROC: HTTP HEAD localhost:port
        PROC-->>RUN: Connection verified
    end
    
    RUN->>DEV: Prompt: Enter domain
    DEV-->>RUN: Domain (e.g., myapp.com)
    
    Note over DEV,UI: Phase 2: Browser Launch
    
    RUN->>BRW: launchBrowser(domain, port, projectPath)
    
    BRW->>PUP: puppeteer.launch({headless: false})
    PUP-->>BRW: Browser instance
    
    BRW->>PUP: browser.pages()[0]
    PUP-->>BRW: Page instance
    
    BRW->>PUP: page.setUserAgent(ATLAS/1.0)
    
    Note over NET: Setup Network Interception
    
    BRW->>NET: createNetworkManager(page, config)
    
    par Expose Bridge Functions
        NET->>PUP: exposeFunction(setThrottling)
        NET->>PUP: exposeFunction(setSecurityMode)
        NET->>PUP: exposeFunction(setChaosConfig)
        NET->>PUP: exposeFunction(startTrafficSim)
    end
    
    NET->>PUP: setRequestInterception(true)
    NET->>PUP: page.on(request, handleRequest)
    NET-->>BRW: NetworkManager ready
    
    Note over REC: Setup Recording
    
    BRW->>REC: attachRecorder(page, config)
    
    par Expose Recording Functions
        REC->>PUP: exposeFunction(atlasStartRecording)
        REC->>PUP: exposeFunction(atlasStopRecording)
        REC->>PUP: exposeFunction(atlasRecordEvent)
    end
    
    REC-->>BRW: SessionRecorder ready
    
    Note over DEV,UI: Phase 3: Tool Injection
    
    BRW->>PUP: evaluateOnNewDocument([UI_SHELL, TOOLS, ...])
    
    Note over PUP: Scripts queued for injection
    
    BRW->>PUP: page.goto(https://domain)
    
    Note over NET: Request Interception Flow
    
    PUP->>NET: Request: https://domain/
    NET->>NET: isMainFrame? Yes
    NET->>NET: Serve Atlas Shell HTML
    NET-->>PUP: HTML with iframe
    
    PUP->>NET: Request: https://domain/path (iframe)
    NET->>NET: isMainFrame? No
    NET->>PROC: fetch(http://localhost:port/path)
    PROC-->>NET: Response
    NET-->>PUP: Proxied response
    
    Note over DEV,UI: Phase 4: UI Ready
    
    PUP->>UI: DOMContentLoaded
    UI->>UI: Create Shadow DOM host
    UI->>UI: Inject CSS styles
    UI->>UI: Create floating pill
    UI->>UI: Register tool panels
    UI-->>DEV: Atlas Interface Ready
    
    Note over DEV,UI: Phase 5: User Interaction
    
    DEV->>UI: Click: Start Recording
    UI->>REC: atlasStartRecording()
    REC->>REC: new PuppeteerScreenRecorder(page)
    REC->>REC: recorder.start(videoPath)
    REC-->>UI: true (success)
    UI->>UI: Update UI state
    
    loop User Testing Session
        DEV->>UI: Interact with project
        UI->>REC: atlasRecordEvent(event)
    end
    
    DEV->>UI: Click: Stop Recording
    UI->>REC: atlasStopRecording()
    REC->>REC: recorder.stop()
    REC-->>UI: filename.mp4
    
    Note over DEV,UI: Phase 6: Cleanup
    
    DEV->>PUP: Close browser window
    PUP->>BRW: Browser disconnect event
    BRW->>REC: generateLog()
    BRW->>REC: generateLog()
    BRW->>PUP: browser.close()
    BRW->>RUN: Cleanup signal
    RUN->>SRV: cleanup()
    SRV->>PROC: Kill process (taskkill/kill)
    RUN-->>DEV: Atlas session ended
```

## Phase Summary

| Phase               | Steps | Components Involved                            | Description                                 |
| ------------------- | ----- | ---------------------------------------------- | ------------------------------------------- |
| 1. Initialization   | 1-18  | CLI, RunCommand, ServerManager                 | Parse command, start server, collect config |
| 2. Browser Launch   | 19-32 | BrowserOrchestrator, Puppeteer, NetworkManager | Launch browser, setup interception          |
| 3. Tool Injection   | 33-42 | Puppeteer, NetworkManager, SessionRecorder     | Inject scripts, navigate to domain          |
| 4. UI Ready         | 43-48 | AtlasUIShell                                   | Create floating interface                   |
| 5. User Interaction | 49-58 | User, SessionRecorder                          | Record session, capture events              |
| 6. Cleanup          | 59-67 | All components                                 | Generate output, kill processes             |

## Message Types

| Type        | Notation         | Description                      |
| ----------- | ---------------- | -------------------------------- |
| Synchronous | ->>              | Blocking call, wait for response |
| Response    | -->>             | Return value from sync call      |
| Internal    | ->>self          | Self-invocation                  |
| Parallel    | par...end        | Concurrent execution             |
| Optional    | opt...end        | Conditional execution            |
| Loop        | loop...end       | Repeated execution               |
| Alternative | alt...else...end | Conditional branching            |
