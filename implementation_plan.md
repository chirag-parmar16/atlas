# Launch Stability & Multi-Tab Support

Address the persistent launch failures (blank page) and implement a single-window tab system for handling `_blank` links.

## User Review Required

> [!IMPORTANT]
> **Multi-Tab Behavior**: Forcing `_blank` links into a single window requires Atlas to manage multiple browser pages behind the scenes. We will add a Tab bar to the HUD to allow switching between them.

## Proposed Changes

### Browser Orchestrator
#### [MODIFY] [browser.ts](file:///d:/Atlas/src/browser/browser.ts)
- **Aggressive Target Recovery**: Overhaul the navigation loop to wait for the webview process to stabilize after initial swap.
- **Tab Management**: 
    - Maintain a `pages` list.
    - Intercept `popup` events (`window.open`).
    - Expose `atlasSwitchTab` and `atlasGetTabs` to the HUD.
    - Sync active tab state to `mainWindow`.

### Host HUD
#### [MODIFY] [index.html](file:///d:/Atlas/src/electron/index.html)
- Add a minimalist **Tab Bar** to the top of the HUD.
- Style active/inactive tab states.

#### [MODIFY] [renderer.css](file:///d:/Atlas/src/electron/renderer.css)
- Implement layout for the new tab bar.
- Add smooth transitions for tab switching.

#### [MODIFY] [renderer.ts](file:///d:/Atlas/src/electron/renderer.ts)
- Handle tab click events and call `atlasSwitchTab`.
- Dynamically update the tab list from the orchestrator events.

## Verification Plan

### Automated Tests
- Build project: `npm run build`
- Run `atlas run`: Verify it loads the project domain without crashing.
- Test `_blank` links: Click a link that opens in a new tab; verify it appears in the Atlas Tab Bar instead of a new window.

### Manual Verification
- Verify that switching tabs correctly updates the URL bar and the Network/Console telemetry for that specific tab.
