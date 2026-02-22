/**
 * Atlas Transport — Protocol
 * 
 * Versioned message types for communication between
 * Engine ↔ Transport ↔ Renderer.
 * 
 * All messages are JSON. Version is embedded for
 * forward compatibility.
 */

import {
    AtlasState,
    ConsoleEntry,
    NetworkRequest,
    Violation,
    PageInfo,
    StorageMetrics,
    NavigationEntry,
    RecorderState,
    ChaosConfig
} from '../engine/state';

// Protocol version
export const PROTOCOL_VERSION = '2.0.0';

// --- Engine → Renderer (via Transport WebSocket) ---

export type ServerMessage =
    | { type: 'STATE_SYNC'; version: string; payload: AtlasState }
    | { type: 'CONSOLE_LOG'; payload: ConsoleEntry }
    | { type: 'NETWORK_EVENT'; payload: NetworkRequest }
    | { type: 'VIOLATION'; payload: Violation }
    | { type: 'PAGE_INFO'; payload: PageInfo }
    | { type: 'STORAGE_METRICS'; payload: StorageMetrics }
    | { type: 'NAVIGATION'; payload: NavigationEntry }
    | { type: 'RECORDER_STATUS'; payload: RecorderState };

// --- Renderer → Engine (via Transport WebSocket) ---

export type ClientMessage =
    | { type: 'SYNC_STATE' }
    | { type: 'START_RECORDING' }
    | { type: 'STOP_RECORDING' }
    | { type: 'TOGGLE_PAUSE'; paused: boolean }
    | { type: 'SET_STRESS_CONFIG'; config: ChaosConfig }
    | { type: 'SET_SECURITY_MODE'; mode: 'Standard' | 'Strict' }
    | { type: 'CLOSE_BROWSER' }
    | { type: 'GO_BACK' }
    | { type: 'GO_FORWARD' }
    | { type: 'MINIMIZE' }
    | { type: 'TOGGLE_WINDOW' }
    | { type: 'RELOAD_PAGE' }
    | { type: 'CLEAR_CONSOLE' }
    | { type: 'CLEAR_NETWORK' }
    | { type: 'REQUEST_PAGE_INFO' }
    | { type: 'REQUEST_STORAGE' };

// --- Helpers ---

export function createServerMessage<T extends ServerMessage['type']>(
    type: T,
    payload: Extract<ServerMessage, { type: T }> extends { payload: infer P } ? P : never
): ServerMessage {
    if (type === 'STATE_SYNC') {
        return { type, version: PROTOCOL_VERSION, payload } as ServerMessage;
    }
    return { type, payload } as ServerMessage;
}

export function parseClientMessage(raw: string): ClientMessage | null {
    try {
        const msg = JSON.parse(raw);
        if (typeof msg.type !== 'string') return null;
        return msg as ClientMessage;
    } catch {
        return null;
    }
}
