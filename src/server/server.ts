
import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

// Helper to spawn and pipe output non-blocking
function spawnAsync(command: string, args: string[], cwd: string, onLog: (msg: string) => void): Promise<void> {
    return new Promise((resolve, reject) => {
        const isWin = process.platform === 'win32';
        const isCmd = command === 'npm' || command === 'npx';

        // Audit Fix: On Windows, .cmd files REQUIRE a shell to run via spawn.
        // We only enable shell: true for these known safe commands to prevent injection.
        const useShell = isWin && isCmd;
        const cmd = useShell ? command : (isWin && isCmd ? `${command}.cmd` : command);

        const child = spawn(cmd, args, { cwd, shell: useShell, stdio: 'pipe' });

        child.stdout?.on('data', (d) => {
            const msg = d.toString().trim();
            if (msg) onLog(msg);
        });
        child.stderr?.on('data', (d) => {
            const msg = d.toString().trim();
            if (msg) onLog(`[ERR] ${msg}`);
        });

        child.on('error', (err) => {
            reject(new Error(`Failed to start process ${cmd}: ${err.message}`));
        });

        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Command ${cmd} ${args.join(' ')} failed with code ${code}`));
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
                let cmd = 'npm';
                let args = ['start'];
                if (pkg.scripts?.dev && !pkg.scripts?.start) {
                    args = ['run', 'dev'];
                } else if (!pkg.scripts?.start && !pkg.scripts?.dev) {
                    if (fs.existsSync(path.join(projectPath, 'server.js'))) {
                        cmd = 'node';
                        args = ['server.js'];
                    } else if (pkg.main && fs.existsSync(path.join(projectPath, pkg.main))) {
                        cmd = 'node';
                        args = [pkg.main];
                    } else if (fs.existsSync(path.join(projectPath, 'index.js'))) {
                        cmd = 'node';
                        args = ['index.js'];
                    } else {
                        throw new Error(`Cannot start project: No 'start' or 'dev' script found in package.json, and no server.js or index.js entry point detected.`);
                    }
                }

                onLog(`[Atlas] Spawning app (${cmd} ${args.join(' ')})...`);
                
                // --- Start the actual child process ---
                const isWin = process.platform === 'win32';
                const isCmd = cmd === 'npm' || cmd === 'npx';
                const useShell = isWin && isCmd;
                const finalCmd = useShell ? cmd : (isWin && isCmd ? `${cmd}.cmd` : cmd);

                const child = spawn(finalCmd, args, {
                    cwd: projectPath,
                    env: { 
                        ...process.env, 
                        // DELIBERATELY OMITTING 'PORT' ENV VAR - Let the user project decide its own port
                        NODE_ENV: process.env.NODE_ENV || 'development' 
                    },
                    shell: useShell, // Audit Fix: Security hardening to prevent RCE
                    stdio: 'pipe'
                });

                // ANSI Color Stripper (removes formatting that confuses regex)
                // eslint-disable-next-line no-control-regex
                const stripAnsi = (str: string) => str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

                // Dynamic Port Detection: Listen for logs that suggest the actual port used
                let detectedPort: number | null = null;
                const portPatterns = [
                    /http:\/\/localhost:(\d+)/i,
                    /http:\/\/127\.0\.0\.1:(\d+)/i,
                    /Local:\s*.*?(?:http:\/\/localhost:)?(\d+)/i,
                    /Server running on (?:http:\/\/localhost:)?(\d+)/i,
                    /ready in .*?http:\/\/localhost:(\d+)/i,
                    /➜\s+Local:\s+http:\/\/localhost:(\d+)/i // Vite specific
                ];

                let lastLogs: string[] = [];
                const addLog = (msg: string) => {
                    const cleanMsg = stripAnsi(msg);
                    lastLogs.push(cleanMsg);
                    if (lastLogs.length > 20) lastLogs.shift();
                    
                    // Scan for port in cleaned message
                    for (const pattern of portPatterns) {
                        const match = cleanMsg.match(pattern);
                        if (match && match[1]) {
                            const newPort = parseInt(match[1]);
                            if (!detectedPort) {
                                detectedPort = newPort;
                                onLog(`[Atlas] Detected app running natively on port ${newPort}.`);
                            }
                        }
                    }
                };

                // Pipe Logs
                child.stdout?.on('data', (d) => {
                    const msg = d.toString().trim();
                    if (msg) { addLog(msg); onLog(msg); }
                });
                child.stderr?.on('data', (d) => {
                    const msg = d.toString().trim();
                    if (msg) { addLog(`[ERR] ${msg}`); onLog(`[ERR] ${msg}`); }
                });

                // Proactive Health Check (Probing multiple ports to find the app since we didn't force one)
                let consecutiveSuccesses = 0;
                const requiredSuccesses = 2;
                const commonPorts = [3000, 3001, 8080, 5173, 5174, 4200];

                let startupTimer: any;
                const checkInterval = setInterval(() => {
                    // Decide which port to check: Detected > Common Fallbacks
                    const portsToCheck = detectedPort ? [detectedPort] : commonPorts;
                    
                    const checkPort = (p: number) => {
                        return new Promise<boolean>((res) => {
                            const req = http.get(`http://127.0.0.1:${p}`, (response) => {
                                response.resume();
                                res(response.statusCode! > 0 && response.statusCode! < 500);
                            });
                            req.on('error', () => res(false));
                            req.setTimeout(200, () => { req.destroy(); res(false); });
                            req.end();
                        });
                    };

                    (async () => {
                        for (const p of portsToCheck) {
                            if (await checkPort(p)) {
                                if (!detectedPort) {
                                    detectedPort = p;
                                    onLog(`[Atlas] Discovered app active on port ${p}.`);
                                }
                                consecutiveSuccesses++;
                                if (consecutiveSuccesses >= requiredSuccesses) {
                                    clearInterval(checkInterval);
                                    if (startupTimer) clearTimeout(startupTimer);
                                    resolve({
                                        port: p,
                                        child,
                                        cleanup: async () => {
                                            if (!child || !child.pid) return;
                                            const treeKill = require('tree-kill');
                                            return new Promise<void>((resolve) => {
                                                treeKill(child.pid, 'SIGTERM', (err?: Error) => {
                                                    if (err) { resolve(); return; }
                                                    const gracePeriod = setTimeout(() => {
                                                        try { process.kill(child.pid!, 0); treeKill(child.pid, 'SIGKILL', () => resolve()); } catch (e) { resolve(); }
                                                    }, 5000);
                                                    child.on('exit', () => { clearTimeout(gracePeriod); resolve(); });
                                                });
                                            });
                                        }
                                    });
                                }
                                return; // Found the active port, wait for next tick to re-verify
                            }
                        }
                        consecutiveSuccesses = 0; // None of the ports responded yet
                    })();
                }, 800);

                // Configurable Timeout
                let startupTimeout = 30000;
                try {
                    const configPath = path.join(projectPath, 'atlas.config.json');
                    if (fs.existsSync(configPath)) {
                        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                        if (config.startupTimeout) startupTimeout = config.startupTimeout;
                    }
                } catch (e) {}

                startupTimer = setTimeout(() => {
                    if (consecutiveSuccesses < requiredSuccesses) {
                        clearInterval(checkInterval);
                        reject(new Error(`Server start timed out after ${startupTimeout}ms. Probed common ports but none responded.\nLast Logs:\n${lastLogs.join('\n')}`));
                        try { child.kill(); } catch (e) {}
                    }
                }, startupTimeout);

                child.on('exit', (code) => {
                    if (code !== null && code !== 0 && consecutiveSuccesses < requiredSuccesses) {
                        clearInterval(checkInterval);

                        reject(new Error(`Server exited (code ${code}).\nLast Logs:\n${lastLogs.join('\n')}`));
                    }
                });
            } catch (e) {
                reject(e);
            }
            return;
        }

        const app = express();
        app.use(express.static(projectPath));
        const staticServer = http.createServer(app);
        staticServer.listen(0, '127.0.0.1', () => {
            const port = (staticServer.address() as AddressInfo).port;
            if (startupTimer) clearTimeout(startupTimer);
                                    resolve({
                port,
                cleanup: async () => { staticServer.close(); }
            });
        });
    });
}
