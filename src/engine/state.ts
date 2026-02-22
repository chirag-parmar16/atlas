/**
 * Atlas Engine — Central State
 * 
 * Single source of truth for all runtime data.
 * Every module reads/writes state through this interface.
 */

// --- Violation ---
export interface Violation {
    type?: 'violation' | 'navigation';
    source: string;
    message: string;
    level?: number;       // 0=INFO, 1=WARN, 2=ERROR
    timestamp: number;
    url: string;
    metadata?: any;
    metrics?: { loadTime: number; storage: number };
}

// --- Console ---
export interface ConsoleEntry {
    level: 'log' | 'warn' | 'error' | 'info' | 'debug';
    message: string;
    timestamp: number;
    stack: string;
}

// --- Network ---
export interface NetworkRequest {
    id: string;
    url: string;
    method: string;
    status: number;
    type: string;
    resourceType?: string;
    time: number;
    reqHeaders: Record<string, string>;
    resHeaders: Record<string, string>;
    body: string;
    _page: string;
}

// --- Navigation ---
export interface NavigationEntry {
    url: string;
    timestamp: number;
    metrics?: {
        loadTime: number;
        storage: number;
    };
}

// --- Page Info (from Collectors) ---
export interface PageInfo {
    title: string;
    url: string;
    charset: string;
    doctype: string;
    readyState: string;
    contentType: string;
    metaTags: { name: string; content: string }[];
    scripts: { external: number; inline: number; urls: string[] };
    stylesheets: { external: number; inline: number; urls: string[] };
    cookies: { name: string; value: string }[];
    localStorage: { key: string; value: string }[];
    sessionStorage: { key: string; value: string }[];
}

// --- Storage Metrics (from Collectors) ---
export interface StorageMetrics {
    domSize: number;
    localStorageSize: number;
    sessionStorageSize: number;
    cookieSize: number;
    totalTransfer: number;
    resources: {
        name: string;
        size: number;
        type: string;
        duration: number;
    }[];
    breakdown: {
        images: number;
        scripts: number;
        styles: number;
        fonts: number;
        other: number;
    };
}

// --- Chaos / Stress Config ---
export interface ChaosConfig {
    enabled: boolean;
    errorRate: number;
    latencyRate: number;
    dropRate: number;
}

// --- Recorder ---
export interface RecorderState {
    isRecording: boolean;
    isPaused: boolean;
    startTime: number | null;
    partCount: number;
}

// --- Atlas Config ---
export interface AtlasConfig {
    domain: string;
    localPort: number;
    projectPath: string;
}

// --- Full State ---
export interface AtlasState {
    config: AtlasConfig;
    violations: Violation[];
    consoleLogs: ConsoleEntry[];
    networkRequests: NetworkRequest[];
    navigations: NavigationEntry[];
    pageInfo: PageInfo | null;
    storageMetrics: StorageMetrics | null;
    chaosConfig: ChaosConfig;
    securityMode: 'Standard' | 'Strict';
    recorder: RecorderState;
    activeTab: string;
}

/**
 * Create a fresh AtlasState with defaults
 */
export function createInitialState(config: AtlasConfig): AtlasState {
    return {
        config,
        violations: [],
        consoleLogs: [],
        networkRequests: [],
        navigations: [],
        pageInfo: null,
        storageMetrics: null,
        chaosConfig: {
            enabled: false,
            errorRate: 0,
            latencyRate: 0,
            dropRate: 0
        },
        securityMode: 'Standard',
        recorder: {
            isRecording: false,
            isPaused: false,
            startTime: null,
            partCount: 0
        },
        activeTab: 'Console'
    };
}
