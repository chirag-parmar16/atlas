/**
 * Atlas Pipeline (Bloodline)
 * 
 * Typed event bus that connects all layers.
 * Engine, Transport, and Collectors never call each other directly —
 * they publish/subscribe through Pipeline.
 * 
 * Usage:
 *   const pipeline = createPipeline();
 *   pipeline.on('violation', (v) => reportManager.log(v));
 *   pipeline.emit('violation', { source: 'PII', message: '...' });
 */

import { EventEmitter } from 'events';

// Import types from Engine
import {
    Violation,
    ConsoleEntry,
    NetworkRequest,
    NavigationEntry,
    PageInfo,
    StorageMetrics,
    RecorderState,
    ChaosConfig
} from '../engine/state';

// ── Pipeline Event Map ──
export interface PipelineEvents {
    // Engine → outward
    'violation': (v: Violation) => void;
    'network:request': (r: NetworkRequest) => void;
    'console:log': (e: ConsoleEntry) => void;
    'navigation': (entry: NavigationEntry) => void;
    'recorder:status': (s: RecorderState) => void;
    'storage:metrics': (m: StorageMetrics) => void;
    'page:info': (p: PageInfo) => void;
    'log': (message: string) => void;

    // UI → Engine (actions from browser-exposed functions)
    'action:stress': (config: ChaosConfig) => void;
    'action:security-mode': (mode: string) => void;
    'action:start-recording': () => void;
    'action:stop-recording': () => void;
    'action:toggle-pause': (paused: boolean) => void;
    'action:close-browser': () => void;
    'action:go-back': () => void;
    'action:go-forward': () => void;
    'action:minimize': () => void;
    'action:toggle-window': () => void;
    'action:reload': () => void;
}

// ── Typed Pipeline class ──
export class Pipeline {
    private emitter: EventEmitter;

    constructor() {
        this.emitter = new EventEmitter();
        this.emitter.setMaxListeners(50); // Many subscribers across layers
    }

    /**
     * Subscribe to a pipeline event.
     */
    on<K extends keyof PipelineEvents>(event: K, listener: PipelineEvents[K]): this {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.emitter.on(event, listener as (...args: any[]) => void);
        return this;
    }

    /**
     * Subscribe to a pipeline event (one time).
     */
    once<K extends keyof PipelineEvents>(event: K, listener: PipelineEvents[K]): this {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.emitter.once(event, listener as (...args: any[]) => void);
        return this;
    }

    /**
     * Emit a pipeline event.
     */
    emit<K extends keyof PipelineEvents>(event: K, ...args: Parameters<PipelineEvents[K]>): boolean {
        return this.emitter.emit(event, ...args);
    }

    /**
     * Remove a listener.
     */
    off<K extends keyof PipelineEvents>(event: K, listener: PipelineEvents[K]): this {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.emitter.off(event, listener as (...args: any[]) => void);
        return this;
    }

    /**
     * Remove all listeners (cleanup on shutdown).
     */
    removeAll(): void {
        this.emitter.removeAllListeners();
    }

    /**
     * Get listener count for debugging.
     */
    listenerCount(event: keyof PipelineEvents): number {
        return this.emitter.listenerCount(event);
    }
}

/**
 * Factory: create a fresh Pipeline instance.
 */
export function createPipeline(): Pipeline {
    return new Pipeline();
}
