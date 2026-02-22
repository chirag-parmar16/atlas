/**
 * Atlas Engine — Public API
 * 
 * Re-exports all engine modules for clean imports.
 */

export { AtlasState, AtlasConfig, Violation, ConsoleEntry, NetworkRequest, NavigationEntry, PageInfo, StorageMetrics, ChaosConfig, RecorderState, createInitialState } from './state';
export { scanForPII, maskPII, isInsecureCORS, PIILeak } from './security-warden';
export { PerformanceTracker, PerformanceAnomaly } from './performance-tracker';
export { createNetworkInterceptor, NetworkInterceptorConfig, NetworkInterceptorCallbacks } from './network-interceptor';
export { ReportManager } from './report-manager';
export { generateAtlasReport, ReportData } from './report-generator';
export { attachRecorder } from './session-recorder';
