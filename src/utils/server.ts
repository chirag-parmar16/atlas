
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

                // Find Port
                const srv = http.createServer();
                srv.listen(0, '127.0.0.1', () => {
                    const port = (srv.address() as AddressInfo).port;
                    srv.close(() => {
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
                                        cleanup: () => {
                                            try {
                                                // Windows tree kill hack or just kill
                                                if (process.platform === 'win32') {
                                                    spawn('taskkill', ['/pid', child.pid!.toString(), '/f', '/t']);
                                                } else {
                                                    child.kill();
                                                }
                                            } catch (e) { }
                                        }
                                    });
                                }
                            });
                            req.on('error', () => { });
                            req.end();
                        }, 500);

                        // Timeout 30s
                        setTimeout(() => {
                            clearInterval(checkInterval);
                            // Resolve anyway, assuming it's up or will be
                            resolve({
                                port,
                                child,
                                cleanup: () => child.kill()
                            });
                        }, 30000);

                        // Early Exit Watch
                        child.on('exit', (code) => {
                            if (code !== null && code !== 0) {
                                clearInterval(checkInterval);
                                reject(new Error(`Server process exited early with code ${code}`));
                            }
                        });
                    });
                });
                return;

            } catch (e) {
                reject(e);
                return;
            }
        }

        // --- STATIC FALLBACK ---
        const app = express();
        app.use(express.static(projectPath));
        const staticServer = http.createServer(app);
        staticServer.listen(0, '127.0.0.1', () => {
            const port = (staticServer.address() as AddressInfo).port;
            resolve({
                port,
                cleanup: () => staticServer.close()
            });
        });
    });
}
