import { Page } from 'puppeteer-core';
import { Pipeline } from '../pipeline/pipeline';

// Define the interface for the metrics
export interface StorageMetricsPayload {
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
    tabId?: string;
}

/**
 * Starts a periodic interval to collect storage and page metrics.
 * Uses the Pipeline to broadcast metrics.
 * 
 * @param getActivePage Function that returns the currently active Puppeteer Page or null
 * @param pipeline The typed event bus
 * @param intervalMs How often to poll metrics (default: 15000ms)
 * @returns A cleanup function to clear the interval
 */
export function startStorageMetricsCollector(
    getActivePage: () => Page | null,
    pipeline: Pipeline,
    intervalMs: number = 15000
): () => void {
    const collectStorage = async () => {
        const page = getActivePage();
        if (!page || page.isClosed()) return;

        try {
            const metrics = await page.evaluate((): StorageMetricsPayload => {
                const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
                const breakdown = { images: 0, scripts: 0, styles: 0, fonts: 0, other: 0 };
                let totalTransfer = 0;

                resources.forEach(r => {
                    totalTransfer += r.transferSize || 0;
                    if (r.initiatorType === 'img' || r.name.match(/\.(png|jpe?g|gif|webp|svg)$/)) breakdown.images += r.transferSize || 0;
                    else if (r.initiatorType === 'script' || r.name.endsWith('.js')) breakdown.scripts += r.transferSize || 0;
                    else if (r.initiatorType === 'css' || r.name.endsWith('.css')) breakdown.styles += r.transferSize || 0;
                    else if (r.initiatorType === 'font' || r.name.match(/\.(woff2?|ttf|otf)$/)) breakdown.fonts += r.transferSize || 0;
                    else breakdown.other += r.transferSize || 0;
                });

                return {
                    domSize: document.documentElement.innerHTML.length,
                    localStorageSize: Object.keys(localStorage).reduce((sum, key) => sum + (localStorage.getItem(key)?.length || 0), 0),
                    sessionStorageSize: Object.keys(sessionStorage).reduce((sum, key) => sum + (sessionStorage.getItem(key)?.length || 0), 0),
                    cookieSize: document.cookie.length,
                    totalTransfer,
                    resources: resources.slice(-5).map(r => ({ name: r.name.split('/').pop() || '', size: r.transferSize, type: r.initiatorType, duration: r.duration })),
                    breakdown
                };
            });

            pipeline.emit('storage:metrics', metrics);
        } catch (e) {
            const err = e as Error;
            // Silent catch during page unloads is expected, but log unexpected errors
            if (!err.message.includes('Target closed') && !err.message.includes('Session closed')) {
                console.error('[Atlas:StorageCollector] Storage metrics collection failed:', err.message);
            }
        }
    };

    const intervalId = setInterval(collectStorage, intervalMs);

    // Return cleanup function
    return () => clearInterval(intervalId);
}
