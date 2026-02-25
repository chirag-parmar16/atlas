/**
 * Atlas Electron — Launcher
 * 
 * Replaces chrome-launcher. Spawns the Electron process
 * with remote debugging enabled, waits for CDP to be ready,
 * and returns the WebSocket endpoint for puppeteer-core.connect().
 * 
 * Usage:
 *   const { wsEndpoint, electronProcess } = await launchElectron();
 *   const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import http from 'http';

export interface ElectronLaunchResult {
    /** WebSocket URL for puppeteer-core.connect() */
    wsEndpoint: string;
    /** The Electron child process */
    electronProcess: ChildProcess;
    /** The debug port being used */
    debugPort: number;
}

/**
 * Find a random available port.
 */
function getRandomPort(): number {
    // Use a port in the ephemeral range
    return 9200 + Math.floor(Math.random() * 800);
}

/**
 * Poll the CDP /json/version endpoint until it responds.
 * Returns the webSocketDebuggerUrl.
 */
function waitForCDP(port: number, timeoutMs: number = 30000): Promise<string> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
        const poll = () => {
            if (Date.now() - startTime > timeoutMs) {
                reject(new Error(`[Atlas] Electron CDP endpoint did not respond within ${timeoutMs / 1000}s`));
                return;
            }

            const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.webSocketDebuggerUrl) {
                            resolve(json.webSocketDebuggerUrl);
                        } else {
                            setTimeout(poll, 300);
                        }
                    } catch {
                        setTimeout(poll, 300);
                    }
                });
            });

            req.on('error', () => {
                setTimeout(poll, 300);
            });

            req.setTimeout(2000, () => {
                req.destroy();
                setTimeout(poll, 300);
            });
        };

        poll();
    });
}

/**
 * Launch Electron with remote debugging and return the CDP endpoint.
 */
export async function launchElectron(domain: string, port: number, projectName: string = '', disabledTabs: string[] = []): Promise<ElectronLaunchResult> {
    const debugPort = getRandomPort();

    // Resolve the Electron binary
    let electronBin: string;
    let electronMain: string;

    if (process.env.ATLAS_PACKAGED) {
        // If packaged, Atlas.exe IS the electron binary
        electronBin = process.execPath;
        // In packaged app, the entry script is already compiled into the app.asar, 
        // passing no arguments causes it to run package.json main -> entry.js
        electronMain = "";
    } else {
        try {
            electronBin = require('electron') as string;
            electronMain = path.join(__dirname, 'electron-main.js');
        } catch {
            throw new Error(
                '[Atlas] Failed to locate Electron binary. Ensure electron is installed: npm install electron'
            );
        }
    }

    console.log(`[Atlas] Launching Electron (debug port: ${debugPort})...`);

    const envArgs = {
        ...process.env,
        ATLAS_DEBUG_PORT: String(debugPort),
        ATLAS_DOMAIN: domain,
        ATLAS_PORT: String(port),
        ATLAS_PROJECT_NAME: projectName,
        ATLAS_DISABLED_TABS: disabledTabs.join(','),
        ATLAS_GUI_MODE: 'true'
    };

    // Crucial: When running from the CLI wrapper, we are in Node mode.
    // We MUST turn this off for the child process so it boots the GUI.
    delete (envArgs as Record<string, string | undefined>).ELECTRON_RUN_AS_NODE;

    // Spawn Electron as child process
    const spawnArgs = electronMain ? [electronMain] : [];
    const electronProcess = spawn(electronBin, spawnArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: envArgs
    });

    // Forward Electron stderr/stdout for debugging
    electronProcess.stdout?.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) console.log(`[Electron] ${msg}`);
    });

    electronProcess.stderr?.on('data', (data) => {
        const msg = data.toString().trim();
        // Filter out noisy GPU/Vulkan warnings
        if (msg && !msg.includes('vulkan') && !msg.includes('GPU') && !msg.includes('Passthrough')) {
            console.log(`[Electron] ${msg}`);
        }
    });

    // Handle unexpected exit
    electronProcess.on('exit', (code) => {
        if (code !== null && code !== 0) {
            console.error(`[Atlas] Electron exited with code ${code}`);
        }
    });

    // Wait for CDP endpoint to be available
    let wsEndpoint: string;
    try {
        wsEndpoint = await waitForCDP(debugPort);
        console.log(`[Atlas] Electron CDP ready: ${wsEndpoint}`);
    } catch (err) {
        electronProcess.kill();
        throw err;
    }

    return {
        wsEndpoint,
        electronProcess,
        debugPort
    };
}

/**
 * Kill the Electron process gracefully.
 */
export function killElectron(electronProcess: ChildProcess): void {
    try {
        if (!electronProcess.killed) {
            electronProcess.kill('SIGTERM');
            // Force kill after 3 seconds if still alive
            setTimeout(() => {
                try {
                    if (!electronProcess.killed) {
                        electronProcess.kill('SIGKILL');
                    }
                } catch { }
            }, 3000);
        }
    } catch { }
}
