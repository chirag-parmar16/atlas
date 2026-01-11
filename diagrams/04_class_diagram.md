# Class Diagram

This diagram shows the object-oriented structure of the Atlas codebase with classes, interfaces, and their relationships.

```mermaid
classDiagram
    direction TB
    
    class AtlasCLI {
        -program: Command
        +name: string = "atlas"
        +version: string = "1.0.0"
        +description: string
        +constructor()
        +parse(argv: string[]): void
        +registerCommands(): void
    }
    
    class RunCommand {
        -projectPath: string
        -projectName: string
        -serverPort: number
        -serverChild: ChildProcess
        -serverCleanup: Function
        -finalDomain: string
        -pendingLogs: string[]
        -logTarget: Function
        +run(): Promise~void~
        -promptForDomain(): Promise~string~
        -promptForPort(): Promise~number~
        -performCleanup(): Promise~void~
        -relayLogs(msg: string): void
    }
    
    class ServerManager {
        <<static>>
        +startServer(projectPath, onLog): Promise~ServerResult~
        -spawnAsync(cmd, args, cwd, onLog): Promise~void~
        -findFreePort(): Promise~number~
        -waitForReady(port): Promise~boolean~
    }
    
    class ServerResult {
        +port: number
        +child: ChildProcess
        +cleanup: Function
    }
    
    class BrowserOrchestrator {
        -browser: Browser
        -page: Page
        -networkManager: NetworkManager
        -recorder: SessionRecorder
        +launchBrowser(domain, port, path): Promise~BrowserResult~
        -injectTools(page: Page): Promise~void~
        -setupMultiTabSupport(): void
        +broadcastLog(msg: string): void
        +close(): Promise~void~
    }
    
    class BrowserResult {
        +broadcastLog: Function
        +close: Function
        +process: ChildProcess
    }
    
    class NetworkManager {
        -page: Page
        -config: NetworkConfig
        -currentThrottlingProfile: string
        -currentSecurityMode: string
        -chaosConfig: ChaosConfig
        +constructor(page, config)
        +init(): Promise~void~
        +attach(page: Page): Promise~void~
        -handleRequest(req, page): Promise~void~
        -exposeControls(): Promise~void~
        -serveAtlasShell(req): Promise~void~
        -proxyToLocalhost(req): Promise~void~
        -applyChaos(req): Promise~boolean~
        -applyThrottling(): Promise~void~
    }
    
    class NetworkConfig {
        <<interface>>
        +domain: string
        +localPort: number
    }
    
    class ChaosConfig {
        <<interface>>
        +enabled: boolean
        +errorRate: number
        +latencyRate: number
        +dropRate: number
    }
    
    class SessionRecorder {
        -page: Page
        -config: RecorderConfig
        -recorder: PuppeteerScreenRecorder
        -videoPath: string
        -sessionEvents: SessionEvent[]
        +constructor(page, config)
        +init(): Promise~void~
        +generateLog(): Promise~void~
        -startRecording(): Promise~boolean~
        -stopRecording(): Promise~string~
        -recordEvent(event): void
    }
    
    class RecorderConfig {
        <<interface>>
        +projectPath: string
    }
    
    class SessionEvent {
        <<interface>>
        +time: string
        +url: string
        +type: EventType
        +details: any
    }

    class AtlasAPI {
        <<singleton>>
        +Severity: SeverityEnum
        +tools: Tool[]
        +violations: Violation[]
        +addTool(name, render, onShow): void
        +reportViolation(source, msg, level): void
        +setRecordingState(active): void
        +logNetworkRequest(data): void
    }
    
    class SeverityEnum {
        <<enumeration>>
        INFO = 0
        WARN = 1
        ERROR = 2
    }
    
    class Tool {
        <<interface>>
        +name: string
        +render(): HTMLElement
        +onShow(): void
    }
    
    class EmbeddedTools {
        <<module>>
        +UI_SHELL: string
        +TOOLS: string
        +CONSOLE: string
        +INSPECTOR: string
        +NETWORK: string
        +RECORDER: string
        +TRAFFIC: string
        +HEALTH: string
        +CHAOS: string
    }

    %% Relationships
    AtlasCLI --> RunCommand : creates
    RunCommand --> ServerManager : uses
    RunCommand --> BrowserOrchestrator : uses
    ServerManager ..> ServerResult : returns
    BrowserOrchestrator ..> BrowserResult : returns
    BrowserOrchestrator --> NetworkManager : creates
    BrowserOrchestrator --> SessionRecorder : creates
    BrowserOrchestrator --> EmbeddedTools : injects
    NetworkManager --> NetworkConfig : uses
    NetworkManager --> ChaosConfig : uses
    SessionRecorder --> RecorderConfig : uses
    SessionRecorder --> SessionEvent : captures
    EmbeddedTools --> AtlasAPI : defines
    AtlasAPI --> Tool : manages
    AtlasAPI --> SeverityEnum : uses
```

## Class Responsibilities

| Class               | File Location                  | Responsibility                           |
| ------------------- | ------------------------------ | ---------------------------------------- |
| AtlasCLI            | atlas.ts                       | CLI entry point, command registration    |
| RunCommand          | src/commands/run.ts            | Main orchestration, lifecycle management |
| ServerManager       | src/utils/server.ts            | Project server spawning and management   |
| BrowserOrchestrator | src/utils/browser.ts           | Puppeteer browser control                |
| NetworkManager      | src/utils/network-manager.ts   | Request interception, domain proxying    |
| SessionRecorder     | src/utils/session-recorder.ts  | Video capture, event logging             |
| AtlasAPI            | src/utils/embedded/ui-shell.ts | In-browser global API                    |
| EmbeddedTools       | src/utils/embedded/index.ts    | Tool panel scripts                       |

## Design Patterns Used

| Pattern   | Implementation            | Purpose                           |
| --------- | ------------------------- | --------------------------------- |
| Singleton | AtlasAPI (window.Atlas)   | Single global API instance        |
| Factory   | ServerManager.startServer | Create appropriate server type    |
| Observer  | Event listeners           | Broadcast logs, violations        |
| Proxy     | NetworkManager            | Intercept and forward requests    |
| Module    | EmbeddedTools             | Encapsulate tool scripts          |
| Strategy  | Throttling profiles       | Interchangeable network behaviors |
