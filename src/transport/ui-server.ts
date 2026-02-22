/**
 * Atlas Transport — UI Server
 * 
 * Express static server that serves the Renderer (standalone web app)
 * at /atlas-ui. The Renderer is loaded in an iframe injected into
 * the user's page.
 */

import express from 'express';
import path from 'path';
import http from 'http';

export class UIServer {
    private app: express.Application;
    private server: http.Server | null = null;
    private port: number = 0;

    constructor() {
        this.app = express();

        // Serve Renderer static files from project source (HTML, CSS, JS are source files, not compiled)
        // __dirname at runtime = dist/src/transport/
        // We need to go up 3 levels to project root, then into src/renderer/
        const rendererPath = path.join(__dirname, '..', '..', '..', 'src', 'renderer');
        this.app.use('/atlas-ui', express.static(rendererPath));

        // Health check
        this.app.get('/atlas-health', (_req, res) => {
            res.json({ status: 'ok', version: '2.0.0' });
        });
    }

    /**
     * Start the UI server on a random available port.
     */
    async start(): Promise<number> {
        return new Promise((resolve) => {
            this.server = this.app.listen(0, () => {
                this.port = (this.server!.address() as any).port;
                console.log(`[Atlas] UI Server serving Renderer at http://localhost:${this.port}/atlas-ui`);
                resolve(this.port);
            });
        });
    }

    /**
     * Get the URL where the Renderer UI is served.
     */
    getRendererUrl(wsPort: number): string {
        return `http://localhost:${this.port}/atlas-ui/index.html?ws=${wsPort}`;
    }

    /**
     * Get the port.
     */
    getPort(): number {
        return this.port;
    }

    /**
     * Shut down the server.
     */
    async close(): Promise<void> {
        if (this.server) {
            return new Promise((resolve) => {
                this.server!.close(() => resolve());
            });
        }
    }
}
