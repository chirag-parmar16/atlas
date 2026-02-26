# Interaction Diagram

This diagram illustrates how data flows through the **7-Layer Architecture** during a developer interaction, specifically showing the **Layer 4 Pipeline** as the central bus.

```mermaid
sequenceDiagram
    participant Dev as "Developer (HUD UI)"
    participant Pipe as "L4: Pipeline (Event Bus)"
    participant Warden as "L3: Security Warden"
    participant Chaos as "L3: Chaos Engine"
    participant Proxy as "L3: Network Interceptor"
    participant Guest as "Browser Guest (Page)"

    Note over Dev, Guest: 1. Configuring Dangerous Conditions
    Dev->>Pipe: emit 'action:stress' (Error Rate 50%)
    Pipe->>Chaos: on 'action:stress' (Update Config)

    Note over Dev, Guest: 2. Intercepted Request Lifecycle
    Guest->>Proxy: Fetch Request (myapp.com)
    Proxy->>Chaos: inject(request)
    
    alt Chance Hit (50%)
        Chaos-->>Proxy: Return HTTP 500
        Proxy-->>Guest: 500 Server Error
        Proxy->>Pipe: emit 'violation' (Chaos Source)
    else Success Path
        Proxy->>Warden: scan(request/response)
        Warden-->>Proxy: Result (PII Found!)
        Proxy->>Pipe: emit 'violation' (Security Warden Source)
        Proxy-->>Guest: Masked Response
    end

    Note over Dev, Guest: 3. Visual Feedback
    Pipe-->>Dev: updateHUD('violation-pulse')
```

## Communication Patterns

1.  **Asynchronous Observation (README Layer 4)**: The Engine (Layer 3) never waits for the UI (Layer 6) to render. All monitoring data is sent to the **Pipeline** and processed out-of-band.
2.  **Shadow DOM Isolation**: The interaction between the **Guest Page** and the **Network Interceptor** is transparent to the guest app code.
3.  **Typed Events**: The Pipeline ensures that the 'Security Warden' and 'Chaos Engine' communicate using shared, typed definitions from `state.ts`.
