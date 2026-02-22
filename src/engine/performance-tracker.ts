/**
 * Atlas Engine — Performance Tracker
 * 
 * Monitors request latency and detects anomalies (requests >2x slower
 * than rolling average, above 250ms threshold).
 * 
 * Extracted from: src/network/network-manager.ts (latencyStore + checkPerformance)
 * 
 * Audit fix: Uses bounded Map instead of unbounded Record to prevent
 * memory leak with dynamic URL paths (e.g. /api/users/123).
 */

import { Violation } from './state';

export interface PerformanceAnomaly {
    urlPath: string;
    duration: number;
    average: number;
}

const MAX_TRACKED_PATHS = 1000;
const MAX_HISTORY_PER_PATH = 5;
const ANOMALY_MULTIPLIER = 2;
const MIN_ANOMALY_THRESHOLD_MS = 250;

export class PerformanceTracker {
    private latencyStore: Map<string, number[]> = new Map();

    /**
     * Record a request duration and check for anomalies.
     * 
     * @returns A Violation if the request is anomalously slow, or null
     */
    check(urlPath: string, duration: number, currentUrl: string): Violation | null {
        let result: Violation | null = null;

        if (!this.latencyStore.has(urlPath)) {
            // Audit fix: Bounded LRU — evict oldest entry if at capacity
            if (this.latencyStore.size >= MAX_TRACKED_PATHS) {
                const firstKey = this.latencyStore.keys().next().value;
                if (firstKey) this.latencyStore.delete(firstKey);
            }
            this.latencyStore.set(urlPath, []);
        }

        const history = this.latencyStore.get(urlPath)!;

        // Need at least 3 samples before detecting anomalies
        if (history.length >= 3) {
            const avg = history.reduce((a, b) => a + b, 0) / history.length;
            if (duration > avg * ANOMALY_MULTIPLIER && duration > MIN_ANOMALY_THRESHOLD_MS) {
                result = {
                    source: 'Performance',
                    message: `Slowness detected on ${urlPath}: ${duration}ms (Avg: ${Math.round(avg)}ms)`,
                    level: 1,
                    timestamp: Date.now(),
                    url: currentUrl
                };
            }
        }

        history.push(duration);
        if (history.length > MAX_HISTORY_PER_PATH) history.shift();

        return result;
    }

    /**
     * Clear all tracked data.
     */
    reset(): void {
        this.latencyStore.clear();
    }

    /**
     * Get current store size (for diagnostics).
     */
    get trackedPaths(): number {
        return this.latencyStore.size;
    }
}
