
import inquirer from 'inquirer';
import path from 'path';
import fs from 'fs';
import { startServer } from '../utils/server';
import { launchBrowser } from '../utils/browser';

export async function run() {
    // Mode: Local atlas run (current directory only)
    const projectPath = process.cwd();
    const projectName = path.basename(projectPath);

    console.clear();
    console.log(`\nStarting Atlas for project: ${projectName}`);

    if (!fs.existsSync(projectPath)) {
        console.error(`Project not found at ${projectPath}`);
        process.exit(1);
    }

    // 1. Log Relay System & Buffering
    const pendingLogs: string[] = [];
    let logTarget: (msg: string) => void = (msg) => {
        pendingLogs.push(msg);
    };

    const onServerLog = (msg: string) => {
        logTarget(msg);
    };

    // 2. SERVER STRATEGY
    let serverPort: number = 0;
    let serverChild: any = null;
    let serverCleanup: any = null;

    const hasPackageJson = fs.existsSync(path.join(projectPath, 'package.json'));

    if (hasPackageJson) {
        // --- AUTOMATED NODE MODE ---
        console.log("Initializing local server...");
        // Start server in background
        const serverPromise = startServer(projectPath, onServerLog)
            .catch(err => {
                console.error("\n\n[Fatal] Server failed to start:", err.message);
                process.exit(1);
            });

        process.stdout.write('\n');
        const domainPrompt = inquirer.prompt([
            {
                type: 'input',
                name: 'domain',
                message: 'Enter Live Server Domain (e.g., example.com):',
                filter: (input: string) => input.trim(),
                validate: (input: string) => input.length > 0 ? true : 'Domain cannot be empty'
            }
        ]);

        const [serverResult, answers] = await Promise.all([serverPromise, domainPrompt]);
        serverPort = serverResult.port;
        serverChild = serverResult.child;
        serverCleanup = serverResult.cleanup;
        var finalDomain = answers.domain;

    } else {
        // --- MANUAL PORT MODE (Python, Go, Static, etc.) ---
        console.log("\n[Atlas] No package.json found. Running in Manual Mode.");

        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'domain',
                message: 'Enter Live Server Domain (e.g., example.com):',
                filter: (input: string) => input.trim(),
                validate: (input: string) => input.length > 0 ? true : 'Domain cannot be empty'
            },
            {
                type: 'number',
                name: 'port',
                message: 'Enter the Localhost Port your project is running on:',
                validate: (input: number) => input > 0 && input < 65536 ? true : 'Invalid Port'
            }
        ]);

        serverPort = answers.port;
        finalDomain = answers.domain;
        console.log(`[Atlas] Connecting to http://localhost:${serverPort}...`);

        // PRE-FLIGHT CHECK
        try {
            // dynamic import to avoid hoisting issues if any, or just use http
            const http = await import('http');
            await new Promise<void>((resolve, reject) => {
                const req = http.get(`http://localhost:${serverPort}`, (res) => {
                    resolve();
                });
                req.on('error', (err) => reject(err));
                req.end();
            });
            console.log("[OK] Connection verified.");
        } catch (e) {
            console.error(`\n[Error] Could not connect to localhost:${serverPort}.`);
            console.error(`Please ensure your server is RUNNING (e.g. 'python server.py') and using port ${serverPort}.`);
            console.error(`Detailed Error: ${(e as any).message}`);
            process.exit(1);
        }
    }

    // Server Ready + User Input Ready
    console.log(`\nMasking localhost:${serverPort} as ${finalDomain}`);
    console.log(`Launching isolated browser...`);

    // 4. Launch Browser
    const { broadcastLog, close, process: browserProcess } = await launchBrowser(finalDomain, serverPort, projectPath);

    // 5. Upgrade Relay
    // Flush pending
    pendingLogs.forEach(msg => broadcastLog(msg));
    pendingLogs.length = 0;

    // Switch target
    logTarget = broadcastLog;

    // 6. Cleanup Hook
    const performCleanup = async () => {
        console.log('\n[Atlas] Cleaning up...');
        // Switch logs back to console so user can see shutdown progress
        logTarget = (msg) => console.log(msg);

        if (serverCleanup) await serverCleanup();
        await close();
        process.exit();
    };

    process.on('SIGINT', performCleanup);

    // Auto-Exit if Browser Window is closed by user
    if (browserProcess) {
        browserProcess.on('close', () => {
            console.log('\n[Atlas] Browser closed. Generating report and exiting...');
            performCleanup();
        });
    }

    // Safety Force Kill if main process exits
    process.on('exit', () => {
        try { serverChild?.kill(); } catch (e) { }
        try { browserProcess?.kill(); } catch (e) { }
    });
}
