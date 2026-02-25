import { HTTPRequest } from 'puppeteer-core';
import { ChaosConfig, Violation } from './state';

export class ChaosEngine {
    private config: ChaosConfig = { enabled: false, errorRate: 0, latencyRate: 0, dropRate: 0 };

    constructor(initialConfig?: ChaosConfig) {
        if (initialConfig) this.config = initialConfig;
    }

    public setConfig(config: ChaosConfig): void {
        this.config = config;
    }

    public getConfig(): ChaosConfig {
        return this.config;
    }

    /**
     * Injects chaos into a request if enabled.
     * @returns Promise<boolean> - true if the request was handled (aborted or responded), false otherwise.
     */
    public async inject(request: HTTPRequest, onViolation: (v: Violation) => void): Promise<boolean> {
        if (!this.config.enabled) return false;

        // 1. Packet Drop Simulation
        if (this.config.dropRate > 0 && Math.random() * 100 < this.config.dropRate) {
            await request.abort('failed');
            return true;
        }

        // 2. HTTP Error Injection
        if (this.config.errorRate > 0 && Math.random() * 100 < this.config.errorRate) {
            const url = new URL(request.url());
            onViolation({
                source: 'Stress Testing',
                message: `Stress 500 Error Injection on ${url.pathname}`,
                level: 2,
                timestamp: Date.now(),
                url: request.url()
            });

            await request.respond({
                status: 500,
                contentType: 'text/html',
                body: '<h1>500 Internal Server Error (Atlas Stress Injection)</h1><p>This error was intentionally injected by the Atlas Stress Engine.</p>'
            });
            return true;
        }

        // 3. Latency Injection
        if (this.config.latencyRate > 0 && Math.random() * 100 < this.config.latencyRate) {
            const delay = 2000 + Math.random() * 3000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        return false;
    }
}
