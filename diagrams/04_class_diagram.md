# Class Diagram

This diagram shows the object-oriented structure of the Atlas codebase with classes, interfaces, and their relationships, based on the reference architecture.

```mermaid
classDiagram
    direction TB
    
    class AtlasCLI {
        -program: Command
        +parse(argv: string[]): void
        +registerCommands(): void
    }
    
    class RunCommand {
        -projectPath: string
        -projectName: string
        -serverPort: number
        -pipeline: Pipeline
        +run(): Promise~void~
        -setupBrowser(): Promise~void~
    }

    class ServerManager {
        <<static>>
        +startServer(projectPath, onLog): Promise~ServerResult~
    }
    
    class BrowserOrchestrator {
        -browser: Browser
        -pipeline: Pipeline
        -reportManager: ReportManager
        +launchBrowser(domain, port, path): Promise~BrowserResult~
        -setupPage(page: Page): Promise~void~
    }
    
    class Pipeline {
        <<EventEmitter>>
        +on(event, callback): void
        +emit(event, data): void
    }

    class NetworkInterceptor {
        -stressor: Stressor
        -securityScanner: SecurityScanner
        -performanceTracker: PerformanceTracker
        +init(): Promise~void~
        +attach(page: Page): Promise~void~
    }
    
    class Stressor {
        -config: ChaosConfig
        +setConfig(config): void
        +inject(request, onViolation): Promise~boolean~
    }

    class SecurityScanner {
        -mode: string
        +scanResponse(pathname, url, body, ...): void
        +checkCORS(pathname, url, headers, ...): void
    }

    class PerformanceTracker {
        +check(pathname, duration, pageUrl): Violation | null
    }

    class SessionRecorder {
        -recorder: PuppeteerScreenRecorder
        +init(): Promise~void~
    }
    
    class ReportManager {
        -projectPath: string
        +logViolation(v: Violation): Promise~void~
        +logNavigation(url, metrics): Promise~void~
    }

    class Violation {
        <<interface>>
        +source: string
        +message: string
        +level: number
        +timestamp: number
        +url: string
    }

    %% Relationships
    AtlasCLI --> RunCommand : creates
    RunCommand --> ServerManager : uses
    RunCommand --> BrowserOrchestrator : uses
    RunCommand --> Pipeline : defines
    BrowserOrchestrator --> NetworkInterceptor : creates
    BrowserOrchestrator --> SessionRecorder : attaches
    BrowserOrchestrator --> ReportManager : creates
    NetworkInterceptor --> Stressor : uses
    NetworkInterceptor --> SecurityScanner : uses
    NetworkInterceptor --> PerformanceTracker : uses
    ReportManager ..> Violation : persists
```

## Class Responsibilities

| Class               | Responsibility                                             |
| ------------------- | ---------------------------------------------------------- |
| AtlasCLI            | Entry point for CLI commands and argument parsing.         |
| RunCommand          | Orchestrates the server and browser lifecycle.             |
| ServerManager       | Manages the local project server process.                  |
| BrowserOrchestrator | Controls the Puppeteer instance and tool injection.        |
| Pipeline            | Central event bus for system-wide communications.          |
| NetworkInterceptor  | Intercepts and analyzes network traffic.                   |
| Stressor            | Injects latency and errors to test application resilience. |
| SecurityScanner     | Scans for PII and security policy violations.              |
| PerformanceTracker  | Monitors and reports on network response times.            |
| SessionRecorder     | Captures video and user interaction logs.                  |
| ReportManager       | Generates JSON and Markdown audit reports.                 |
