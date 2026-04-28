# Graph Report - D:\Atlas  (2026-04-28)

## Corpus Check
- 59 files · ~4,542,091 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 236 nodes · 259 edges · 49 communities detected
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]

## God Nodes (most connected - your core abstractions)
1. `TabManager` - 17 edges
2. `ReportManager` - 10 edges
3. `ProxyEngine` - 9 edges
4. `ReportTabManager` - 9 edges
5. `Pipeline` - 8 edges
6. `launchBrowser()` - 7 edges
7. `ConfigManager` - 7 edges
8. `SecurityScanner` - 7 edges
9. `AiService` - 6 edges
10. `$()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `launchBrowser()` --calls--> `createPipeline()`  [INFERRED]
  D:\Atlas\src\browser\browser.ts → D:\Atlas\src\pipeline\pipeline.ts
- `launchBrowser()` --calls--> `startStorageMetricsCollector()`  [INFERRED]
  D:\Atlas\src\browser\browser.ts → D:\Atlas\src\collectors\storage-metrics.ts
- `run()` --calls--> `launchBrowser()`  [INFERRED]
  D:\Atlas\src\cli\run.ts → D:\Atlas\src\browser\browser.ts
- `run()` --calls--> `startServer()`  [INFERRED]
  D:\Atlas\src\cli\run.ts → D:\Atlas\src\server\server.ts
- `launchBrowser()` --calls--> `launchElectron()`  [INFERRED]
  D:\Atlas\src\browser\browser.ts → D:\Atlas\src\electron\electron-launcher.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.1
Nodes (7): PerformanceTracker, StrictWarden, SecurityScanner, isInsecureCORS(), isValidJWT(), luhnCheck(), scanForPII()

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (9): launchBrowser(), getRandomPort(), launchElectron(), waitForCDP(), scanLinksForPage(), startLinkScanner(), createPipeline(), Pipeline (+1 more)

### Community 2 - "Community 2"
Cohesion: 0.19
Nodes (7): $(), escapeHtml(), ExplorerTree, formatSize(), loadExplorer(), ReportTabManager, setupSettings()

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (6): ReportManager, buildTreeReport(), generateMarkdown(), getLocalUrl(), getNormalizedEffectiveUrl(), normalizePath()

### Community 4 - "Community 4"
Cohesion: 0.18
Nodes (1): TabManager

### Community 5 - "Community 5"
Cohesion: 0.21
Nodes (2): AiService, ConfigManager

### Community 6 - "Community 6"
Cohesion: 0.21
Nodes (6): finalizeSplash(), onDragging(), runSplashSequence(), toggleMenu(), updateMenuPosition(), updateUI()

### Community 7 - "Community 7"
Cohesion: 0.2
Nodes (3): readConsole(), run(), startServer()

### Community 8 - "Community 8"
Cohesion: 0.2
Nodes (1): ProxyEngine

### Community 9 - "Community 9"
Cohesion: 0.47
Nodes (3): formatHeaders(), renderDetails(), syntaxHighlightJSON()

### Community 10 - "Community 10"
Cohesion: 0.47
Nodes (3): formatTime(), processQueue(), sendEvent()

### Community 11 - "Community 11"
Cohesion: 0.4
Nodes (1): ChaosEngine

### Community 12 - "Community 12"
Cohesion: 0.4
Nodes (0): 

### Community 13 - "Community 13"
Cohesion: 0.83
Nodes (3): detectProjectType(), init(), readConsole()

### Community 14 - "Community 14"
Cohesion: 0.67
Nodes (2): getActiveTabData(), getOrCreateTabData()

### Community 15 - "Community 15"
Cohesion: 0.5
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 1.0
Nodes (2): copyDir(), copyFile()

### Community 17 - "Community 17"
Cohesion: 0.67
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 0.67
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 19`** (2 nodes): `updateConfig()`, `atlas.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (2 nodes): `renderApplication()`, `application.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (2 nodes): `extras.ts`, `renderRecorder()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (2 nodes): `links.ts`, `renderLinks()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (2 nodes): `security-monitor.ts`, `renderSecurity()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (2 nodes): `stability.ts`, `renderStability()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (2 nodes): `network-interceptor.ts`, `createNetworkInterceptor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (2 nodes): `report-utils.spec.ts`, `constructor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (2 nodes): `session-recorder.ts`, `attachRecorder()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (2 nodes): `state.ts`, `createInitialState()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (2 nodes): `gui-launcher.ts`, `launchGui()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `entry.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `eslint.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `jest.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `electron-main.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `preload.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `tab-manager.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `console.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `links.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `stability.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `storage.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `chaos-engine.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `network-interceptor.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `report-manager.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (1 nodes): `route-warden.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (1 nodes): `security-warden.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (1 nodes): `validation.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `validation.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `pipeline.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ProxyEngine` connect `Community 8` to `Community 0`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `run()` connect `Community 7` to `Community 1`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._