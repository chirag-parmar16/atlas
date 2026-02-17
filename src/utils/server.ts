
import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

// Helper to spawn and pipe output non-blocking
function spawnAsync(command: string, args: string[], cwd: string, onLog: (msg: string) => void): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { cwd, shell: true, stdio: 'pipe' });

        child.stdout?.on('data', (d) => {
            const msg = d.toString().trim();
            if (msg) onLog(msg);
        });
        child.stderr?.on('data', (d) => {
            const msg = d.toString().trim();
            if (msg) onLog(`[ERR] ${msg}`);
        });

        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Command ${command} ${args.join(' ')} failed with code ${code}`));
        });
    });
}

export function startServer(projectPath: string, onLog: (msg: string) => void = () => { }): Promise<{ port: number, child?: ChildProcess, cleanup?: () => void }> {
    return new Promise(async (resolve, reject) => {

        // --- DYNAMIC NODE APP ---
        if (fs.existsSync(path.join(projectPath, 'package.json'))) {
            try {
                // 1. Install
                if (!fs.existsSync(path.join(projectPath, 'node_modules'))) {
                    onLog("[Atlas] Installing dependencies...");
                    await spawnAsync('npm', ['install'], projectPath, onLog);
                }

                // 2. Build
                const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'));
                if (pkg.scripts) {
                    if (pkg.scripts.build) {
                        onLog("[Atlas] Building project...");
                        await spawnAsync('npm', ['run', 'build'], projectPath, onLog);
                    } else if (pkg.scripts['build-client']) {
                        onLog("[Atlas] Building client...");
                        await spawnAsync('npm', ['run', 'build-client'], projectPath, onLog);
                    } else if (pkg.scripts['build:all']) {
                        onLog("[Atlas] Building all...");
                        await spawnAsync('npm', ['run', 'build:all'], projectPath, onLog);
                    }
                }

                // 3. Start
                let npmArgs = ['start'];
                if (!pkg.scripts?.start && pkg.scripts?.dev) {
                    npmArgs = ['run', 'dev'];
                }

                // Find Port: BUG-003 — Minimize race window by resolving as quickly as possible
                const getFreePort = (): Promise<number> => new Promise((res) => {
                    const srv = http.createServer();
                    srv.listen(0, '127.0.0.1', () => {
                        const p = (srv.address() as AddressInfo).port;
                        srv.close(() => res(p));
                    });
                });

                const port = await getFreePort();
                onLog(`[Atlas] Spawning app on port ${port}...`);

                const child = spawn('npm', npmArgs, {
                    cwd: projectPath,
                    env: { ...process.env, PORT: port.toString(), NODE_ENV: 'production' },
                    shell: true,
                    stdio: 'pipe'
                });

                // Pipe Logs
                child.stdout?.on('data', (d) => onLog(d.toString().trim()));
                child.stderr?.on('data', (d) => onLog(`[ERR] ${d.toString().trim()}`));

                // Wait for readiness
                const checkInterval = setInterval(() => {
                    const req = http.get(`http://127.0.0.1:${port}`, (res) => {
                        if (res.statusCode) {
                            clearInterval(checkInterval);
                            resolve({
                                port,
                                child,
                                cleanup: async () => {
                                    if (!child || !child.pid) return;

                                    // Use tree-kill for cross-platform process tree termination
                                    const treeKill = require('tree-kill');

                                    return new Promise<void>((resolve) => {
                                        // Attempt graceful shutdown first
                                        treeKill(child.pid, 'SIGTERM', (err?: Error) => {
                                            if (err) {
                                                // Process already dead or error occurred
                                                resolve();
                                                return;
                                            }

                                            // Wait 5 seconds for graceful shutdown
                                            const gracePeriod = setTimeout(() => {
                                                // Force kill if still alive after grace period
                                                try {
                                                    process.kill(child.pid!, 0); // Check if still alive
                                                    treeKill(child.pid, 'SIGKILL', () => {
                                                        resolve();
                                                    });
                                                } catch (e) {
                                                    // Process already dead
                                                    resolve();
                                                }
                                            }, 5000);

                                            // If process dies during grace period, clear timeout
                                            child.on('exit', () => {
                                                clearTimeout(gracePeriod);
                                                resolve();
                                            });
                                        });
                                    });
                                }
                            });
                        }
                    });
                    req.on('error', () => { });
                    req.end();
                }, 500);

                // Configurable Timeout (Env Var > Config File > Default 30s)
                let startupTimeout = 30000; // Default
                try {
                    const configPath = path.join(projectPath, 'atlas.config.json');
                    if (fs.existsSync(configPath)) {
                        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                        if (config.startupTimeout) startupTimeout = config.startupTimeout;
                    }
                    if (process.env.ATLAS_STARTUP_TIMEOUT) {
                        startupTimeout = parseInt(process.env.ATLAS_STARTUP_TIMEOUT);
                    }
                } catch (e) {
                    // Ignore config parsing errors, use default
                }

                if (startupTimeout === 30000) {
                    onLog(`[Atlas] Using default startup timeout: ${startupTimeout}ms`);
                }

                setTimeout(() => {
                    clearInterval(checkInterval);
                    // Fix: Reject cleanly instead of launching dead
                    reject(new Error(`Server start timed out (${startupTimeout}ms). Port did not become active.`));
                    try { child.kill(); } catch (e) { }
                }, startupTimeout);

                // Early Exit Watch
                child.on('exit', (code) => {
                    if (code !== null && code !== 0) {
                        clearInterval(checkInterval);
                        reject(new Error(`Server process exited early with code ${code}`));
                    }
                });
            } catch (e) {
                reject(e);
            }
            return;
        }

        // --- STATIC FALLBACK ---
        const app = express();
        app.use(express.static(projectPath));
        const staticServer = http.createServer(app);
        staticServer.listen(0, '127.0.0.1', () => {
            const port = (staticServer.address() as AddressInfo).port;
            resolve({
                port,
                cleanup: async () => { staticServer.close(); }
            });
        });
    });
}
