# Atlas v1.1: Engine-Renderer Decoupling

Make Atlas antifragile and future-proof by formalizing and implementing a strict Engine–Renderer separation with a frozen protocol boundary for v1.1.

## Proposed Changes

### Phase 1 — Engine Stabilization (Backend First, UI Ignored)
- **Centralize State in `server.ts`**: Create a single `AtlasState` object holding config, history, and runtime. No UI file is allowed to mutate state directly.
- **Make CDP the Only Telemetry Source**: All network, navigation, console, and performance events via Puppeteer CDP. Remove `page.evaluate` UI updates.
- **Implement WebSocket Server in Engine**: `ws://localhost:PORT/atlas` to broadcast `STATE_UPDATE` to all clients.
- **Define Strict Action Dispatcher**: Receive JSON actions, validate, mutate state, and broadcast. 

### Phase 2 — Protocol Freeze
- **Define Message Types**: `STATE_UPDATE` (Engine -> Renderer), `CONFIG_UPDATE` / `ACTION` (Renderer -> Engine), `SYNC_STATE` (Renderer -> Engine).
- **Version the Protocol**: Add `protocolVersion` to JSON.
- **Document Contract**: Create `docs/protocol.md`. This becomes the strict law of the architecture.

### Phase 3 — Bootstrap Freeze (Minimal Injection Layer)
- **Dumb bridge**: Inject via `evaluateOnNewDocument`, mount a single `<iframe>` pointing to `http://localhost:PORT/atlas-ui`. Absolutely no event listeners or routing hooks. Hard rule: must remain under 50 lines.

### Phase 4 — Renderer Implementation (Stateless UI)
- **Build UI as a client**: Renderer connects to WS, syncs state, replaces local state, and renders. On interaction, sends action JSON. Renderer must tolerate disconnection, reload, and SPA navigation without affecting the Engine.

## Verification Plan
### Phase 5 — Failure Tolerance Test
- Kill UI iframe manually → Engine must keep running.
- Reload page 10 times → State must persist.
- Disconnect WebSocket → Reconnect and resync state.
- Disable UI injection entirely → Engine still logs telemetry.
