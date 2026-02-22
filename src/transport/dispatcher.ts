/**
 * Atlas Transport — Action Dispatcher
 * 
 * Routes Renderer actions to the correct Engine module.
 * Validates actions before forwarding.
 */

import { Page } from 'puppeteer-core';
import { ClientMessage } from './protocol';
import { AtlasState, ChaosConfig } from '../engine/state';

export interface DispatcherDependencies {
    /** The active Puppeteer page */
    getPage: () => Page | null;
    /** Engine state mutators */
    state: AtlasState;
    /** Session recorder controls */
    recorder: {
        start: () => Promise<boolean>;
        stop: () => Promise<string | null>;
        togglePause: (paused: boolean) => Promise<void>;
    } | null;
    /** Network interceptor controls */
    networkInterceptor: {
        setSecurityMode: (mode: 'Standard' | 'Strict') => void;
        setStressConfig: (config: ChaosConfig) => void;
    } | null;
    /** Browser close callback */
    onClose: () => Promise<void>;
}

export class ActionDispatcher {
    private deps: DispatcherDependencies;

    constructor(deps: DispatcherDependencies) {
        this.deps = deps;
    }

    /**
     * Dispatch a client message to the appropriate Engine handler.
     */
    async dispatch(msg: ClientMessage): Promise<void> {
        const page = this.deps.getPage();

        switch (msg.type) {
            case 'GO_BACK':
                if (page) { try { await page.goBack(); } catch (e) { } }
                break;

            case 'GO_FORWARD':
                if (page) { try { await page.goForward(); } catch (e) { } }
                break;

            case 'RELOAD_PAGE':
                if (page) { try { await page.reload(); } catch (e) { } }
                break;

            case 'CLOSE_BROWSER':
                await this.deps.onClose();
                break;

            case 'MINIMIZE':
                if (page) {
                    try {
                        const session = await page.target().createCDPSession();
                        const { windowId } = await session.send('Browser.getWindowForTarget') as any;
                        await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
                    } catch (e) { }
                }
                break;

            case 'TOGGLE_WINDOW':
                if (page) {
                    try {
                        const session = await page.target().createCDPSession();
                        const result = await session.send('Browser.getWindowForTarget') as any;
                        const newState = result.bounds.windowState === 'normal' ? 'maximized' : 'normal';
                        await session.send('Browser.setWindowBounds', { windowId: result.windowId, bounds: { windowState: newState } });
                    } catch (e) { }
                }
                break;

            case 'SET_STRESS_CONFIG':
                if (this.deps.networkInterceptor) {
                    this.deps.networkInterceptor.setStressConfig(msg.config);
                }
                this.deps.state.chaosConfig = msg.config;
                break;

            case 'SET_SECURITY_MODE':
                if (this.deps.networkInterceptor) {
                    this.deps.networkInterceptor.setSecurityMode(msg.mode);
                }
                this.deps.state.securityMode = msg.mode;
                break;

            case 'START_RECORDING':
                if (this.deps.recorder) {
                    await this.deps.recorder.start();
                }
                break;

            case 'STOP_RECORDING':
                if (this.deps.recorder) {
                    await this.deps.recorder.stop();
                }
                break;

            case 'TOGGLE_PAUSE':
                if (this.deps.recorder) {
                    await this.deps.recorder.togglePause(msg.paused);
                }
                break;

            case 'CLEAR_CONSOLE':
                this.deps.state.consoleLogs.length = 0;
                break;

            case 'CLEAR_NETWORK':
                this.deps.state.networkRequests.length = 0;
                break;

            case 'SYNC_STATE':
                // Handled by WS server on connection
                break;

            case 'REQUEST_PAGE_INFO':
            case 'REQUEST_STORAGE':
                // These trigger Collectors via exposed Puppeteer functions
                // The data flows back through Engine → Transport → Renderer
                break;

            default:
                console.warn(`[Atlas] Unknown action: ${(msg as any).type}`);
        }
    }
}
