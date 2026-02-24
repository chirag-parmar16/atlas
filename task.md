# Phase 2: Strict Static Analysis

## 1. Purge `any` Types
- [x] Audit and remove `any` from [src/engine/state.ts](file:///d:/Atlas/src/engine/state.ts).
- [x] Audit and remove `any` from [src/pipeline/pipeline.ts](file:///d:/Atlas/src/pipeline/pipeline.ts).
- [x] Strengthen `.config.json` parsing types.

## 2. Formatting & Linting
- [x] Install ESLint and `@typescript-eslint/eslint-plugin`.
- [x] Install Prettier.
- [x] Define `.eslintrc.json` or `.eslintrc.js` and `.prettierrc`.
- [x] Add `"lint"` script to [package.json](file:///d:/Atlas/package.json) and verify successful 0-warning lint run.

## 3. Test Automation
- [x] Install `jest`, `ts-jest`, `@types/jest`.
- [x] Create `jest.config.js` and add `test` script.
- [x] Write [src/pipeline/pipeline.spec.ts](file:///d:/Atlas/src/pipeline/pipeline.spec.ts).
- [x] Write [src/engine/report-manager.spec.ts](file:///d:/Atlas/src/engine/report-manager.spec.ts).
- [x] Write [src/engine/security-warden.spec.ts](file:///d:/Atlas/src/engine/security-warden.spec.ts).

## 4. Debug Telemetry & UI
- [x] Debug missing Console and Networks data.
- [x] Resolve violation count discrepancy by broadening UI filters.
- [x] Implement multi-listener event system for HUD tools.
- [x] Fix ReferenceError crash in browser.ts by refactoring page variable scope.
- [x] Verify all tools receive bridged data correctly without callback overwrites.

## 5. UI/UX Refinement
- [x] Refactor Networks details to be inline (not a separate window).
- [x] Improve Network Details UI (Headers, Response, Preview) to be "perfect".
- [x] Ensure consistent "premium" aesthetic across redesigned views.
- [x] Reorder HUD tabs as requested (not alphabetical).
- [x] Refine Network List UI with Name, Status, Type, Size, and Time columns.

## 6. Telemetry Scope & Console Fixes
- [x] Clear Network traffic and Violation lists on main frame navigation.
- [x] Debug and fix Console log bridging (ensure all log types are captured).
- [x] Refactor Networks UI: Implement "Details below item" (accordion/split) instead of back button.

## 7. Performance & Aesthetic Polish
- [x] Refine HUD Menu width (narrower) & Correct Height (480px).
- [x] Optimize Networks tab performance (throttled rendering, DOM fragments).
- [x] Optimize Console tab performance (throttled rendering, removed backdrop-blur items).
- [x] Modernize Tab styling (subtle indicator, high-contrast active state).

## 8. Final Aesthetic & Launch Refinement
- [x] Implement 'Outfit' primary font family (modern sans-serif).
- [x] Customize Scrollbars (theme-aware, minimal design).
- [x] Fix Launch-to-Blank-Page issue (ensure smooth transition to guest page).

## 9. Premium UI Reconstruction (Old Code Aesthetic)
- [x] Restore 'Inter' / 'JetBrains Mono' font stacks.
- [x] Redesign HUD bar and URL bar proportions (40px height).
- [x] Redesign Floating Pill (Atlas capsule design).
- [x] Refine Menu Tabs and Content rows to match screenshots exactly.
- [x] Restore "Yellow Bar" stressors UI.

## 10. Premium UI Final Polish
- [x] Fix persistent "Blank Page on Launch" issue (opacity/load timing).
- [x] Restrict "Black Box" container to Networks tab ONLY.
- [x] Overhaul Console readability (text wrap, contrast, spacing).
- [x] Revert generic containers in Links, Storage, Application, Scalability.
- [x] Refine Preview box with padding and borders.

## 11. Links & Stability Integration
- [x] Implement background link validation in [browser.ts](file:///d:/Atlas/src/browser/browser.ts).
- [x] Filter Links tab to show only accessible links.
- [x] Report broken links as `Scalability` violations in Live Monitor.

## 12. CLI UI Refinement
- [x] Refine [isViolation](file:///d:/Atlas/src/cli/run.ts#30-39) heuristic in [run.ts](file:///d:/Atlas/src/cli/run.ts) (fix "override" false positive).

## 13. Screen Recording Enhancements
- [x] Expose recorder controls to Host HUD in [browser.ts](file:///d:/Atlas/src/browser/browser.ts).
- [x] Add recording indicator, timer, and controls to pill in [index.html](file:///d:/Atlas/src/electron/index.html).
- [x] Implement timer logic and state handling in [renderer.ts](file:///d:/Atlas/src/electron/renderer.ts).
- [x] Auto-close menu on recording start.
- [x] Verify FFMPEG merge and final video output.

## 14. Launch Stability & Blank Page Fix
- [x] Disable Electron Site Isolation to stabilize CDP sessions.
- [x] Support `webview` targets in [browser.ts](file:///d:/Atlas/src/browser/browser.ts) `targetcreated` handler.
- [x] Add navigation retry logic in [browser.ts](file:///d:/Atlas/src/browser/browser.ts) (if session closed).

## 15. TypeScript Refinement
- [x] Fix `any` type and property errors in [extras.ts](file:///d:/Atlas/src/electron/ui/extras.ts).

## 16. Launch Stability & Multi-Tab Hub
- [ ] Fix persistent "Session closed" during initial navigation.
- [ ] Implement `popup` interception for single-window tabs.
- [ ] Add Tab Bar UI to Host HUD.
- [ ] Implement Tab switching logic in Browser Orchestrator.
- [ ] Verify tab-specific telemetry (Network/Console).
