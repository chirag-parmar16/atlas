import inquirer from 'inquirer';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';

async function readConsole(promptText: string): Promise<string> {
    return new Promise<string>((resolve) => {
        process.stdout.write(promptText);

        // Use generic readline for normal environments
        if (process.stdin.isTTY) {
            const rl = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });
            rl.question('', (answer: string) => {
                rl.close();
                resolve(answer.trim());
            });
            return;
        }

        // Fallback for packaged Electron Windows apps where stdin/stdout is detached
        try {
            const fd = fs.openSync('\\\\.\\CON', 'rs');
            const buf = Buffer.alloc(512);
            const bytesRead = fs.readSync(fd, buf, 0, 512, null);
            fs.closeSync(fd);
            resolve(buf.toString('utf8', 0, bytesRead).trim());
        } catch (e) {
            console.error('\n\x1b[31m[Error] Cannot read from console. Please run this command from a standard terminal.\x1b[0m');
            process.exit(1);
        }
    });
}

import { startServer } from '../server/server';
import { launchBrowser } from '../browser/browser';

// --- CONFIG & THEME ---
const NEON_GREEN = chalk.hex('#39ff14');
const CYAN = chalk.hex('#00f0ff');
const YELLOW = chalk.hex('#fcee0a');
const GRAY = chalk.gray;

// --- STATE ---
let startTime = Date.now();
let requestCount = 0;
let violationCount = 0;
let chaosEvents = 0;
let isLive = false;

// --- HELPERS ---
function getUptime(): string {
    const diff = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function isViolation(msg: string): boolean {
    const m = msg.toLowerCase();
    // Use regex with word boundaries to avoid partial matches like "override" containing "err"
    const hasError = /\[err\]/i.test(msg) || /error:/i.test(msg) || /\bfailed\b/i.test(m);
    const hasSecurity = m.includes('violation') || m.includes('security') || m.includes('pii') ||
        m.includes('leak') || m.includes('broken link');

    return hasError || hasSecurity;
}

function isRequest(msg: string): boolean {
    const m = msg.toLowerCase();
    return m.includes('200 ok') || m.includes('[fetch]') || (m.includes('request') && !m.includes('failed'));
}

function getPrefix(): string {
    const time = GRAY(getUptime());
    const reqs = CYAN(`${requestCount}↗`);
    const viols = violationCount > 0
        ? chalk.redBright(`${violationCount}⚠`)
        : NEON_GREEN(`0✓`);
    return `${GRAY('[')}${time} ${GRAY('│')} ${reqs} ${GRAY('│')} ${viols}${GRAY(']')}`;
}

function colorizeLog(msg: string): string {
    let icon = GRAY('▪');
    let color = chalk.white;

    if (msg.includes('PII') || msg.includes('Leak') || msg.includes('Security')) {
        icon = chalk.red('█'); color = chalk.redBright;
    } else if (msg.includes('Error') || msg.includes('Failed') || msg.includes('[ERR]')) {
        icon = chalk.red('▪'); color = chalk.red;
    } else if (msg.includes('Violation') || msg.includes('Chaos')) {
        icon = chalk.yellow('▪'); color = chalk.yellow;
    } else if (msg.includes('Fetch') || msg.includes('OK')) {
        icon = chalk.green('▪'); color = chalk.green;
    } else if (msg.includes('[Atlas]')) {
        icon = chalk.cyan('▪'); color = chalk.cyan;
    }

    return `${icon} ${color(msg)}`;
}

// --- MAIN COMMAND ---
export async function run() {
    const projectPath = process.cwd();
    const projectName = path.basename(projectPath);

    console.clear();

    // 1. Startup Header
    console.log('');
    console.log(NEON_GREEN.bold(`    ___  _____ __    ___   ____`));
    console.log(NEON_GREEN.bold(`   /   |/_  __/ /   /   | / __/`));
    console.log(NEON_GREEN.bold(`  / /| | / / / /   / /| | \\ \\  `));
    console.log(NEON_GREEN.bold(` / ___ |/ / / /___/ ___ |__/ / `));
    console.log(NEON_GREEN.bold(`/_/  |_/_/ /_____/_/  |_|___/  `) + GRAY(' v1.1.1'));
    console.log(GRAY('   ────────────────────────────────────────────────────────'));
    console.log(`   ${CYAN('Project:')} ${projectName} ${GRAY(`(${projectPath})`)}`);
    console.log(GRAY('   ────────────────────────────────────────────────────────'));
    console.log('');

    const configPath = path.join(projectPath, 'atlas.config.json');
    let atlasConfig: { targetDomain?: string, disabledTabs?: string[], strictMode?: boolean, basePath?: string, allowedRoutes?: string[], appUrl?: string } = {};
    if (fs.existsSync(configPath)) {
        try {
            atlasConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        } catch (e) {
            console.log(`   ${chalk.yellow('WARNING')} Failed to parse atlas.config.json`);
        }
    } else {
        console.log(`   ${chalk.red.bold('ERROR')} ${chalk.white('Atlas is not initialized.')}`);
        process.exit(1);
    }

    const pendingLogs: string[] = [];
    const logToTerminal = (message: string) => {
        const lines = String(message).split('\n');
        for (const msg of lines) {
            const trimmed = msg.trim();
            if (!trimmed) continue;

            if (isViolation(trimmed)) violationCount++;
            else if (isRequest(trimmed)) requestCount++;
            if (trimmed.includes('Stress') || trimmed.includes('Chaos')) chaosEvents++;

            if (!isLive) {
                pendingLogs.push(trimmed);
                continue;
            }

            console.log(`${getPrefix()} ${colorizeLog(trimmed)}`);
        }
    };

    const onServerLog = (msg: string) => logToTerminal(msg);

    // --- SETUP PHASE ---
    let serverPort: number = 0;
    let serverCleanup: (() => void) | undefined | null = null;
    let finalDomain: string = '';

    const hasPackageJson = fs.existsSync(path.join(projectPath, 'package.json'));

    if (hasPackageJson) {
        console.log(YELLOW('   MODE AUTO') + GRAY(' • package.json detected'));
        console.log('');

        const serverPromise = startServer(projectPath, onServerLog);

        if (!atlasConfig.targetDomain) {
            console.log(`   ${chalk.red.bold('ERROR')} ${chalk.white('No targetDomain found in atlas.config.json. Please run "atlas init" again.')}`);
            process.exit(1);
        }

        const serverResult = await serverPromise;
        serverPort = serverResult.port;
        serverCleanup = serverResult.cleanup;
        finalDomain = atlasConfig.targetDomain;
        console.log(`   ${NEON_GREEN('✓')} Using target domain: ${CYAN(finalDomain)}`);
        // Remove domain prompt since it's already in the config
    } else {
        console.log(YELLOW('   MODE MANUAL') + GRAY(' • No package.json detected'));
        console.log('');

        // === MANUAL MODE ===
        if (!atlasConfig.targetDomain) {
            console.log(`   ${chalk.red.bold('ERROR')} ${chalk.white('No targetDomain found in atlas.config.json. Please run "atlas init" again.')}`);
            process.exit(1);
        }

        console.log(`   ${NEON_GREEN('✓')} Using target domain: ${CYAN(atlasConfig.targetDomain)}`);
        finalDomain = atlasConfig.targetDomain;

        let isPortValid = false;
        while (!isPortValid) {
            const answer = await readConsole('Enter localhost port: ');
            const n = parseInt(answer);
            if (!isNaN(n) && n > 0 && n < 65536) {
                serverPort = n;
                isPortValid = true;
            } else {
                console.log('\x1b[31mPlease enter a valid port number (1-65535)\x1b[0m');
            }
        }
    }

    // --- LIVE PHASE ---
    console.clear();
    startTime = Date.now();
    isLive = true;

    // BIG NEON GREEN HEADER
    console.log('');
    console.log(NEON_GREEN.bold(`    ___  _____ __    ___   ____`));
    console.log(NEON_GREEN.bold(`   /   |/_  __/ /   /   | / __/`));
    console.log(NEON_GREEN.bold(`  / /| | / / / /   / /| | \\ \\  `));
    console.log(NEON_GREEN.bold(` / ___ |/ / / /___/ ___ |__/ / `));
    console.log(NEON_GREEN.bold(`/_/  |_/_/ /_____/_/  |_|___/  `) + GRAY(' v1.1.1'));
    console.log('');

    // Info & Matrix Badges (Static Block)
    console.log(`   ${NEON_GREEN('●')} ${chalk.white.bold('LIVE SESSION')}  ${GRAY('│')}  ${CYAN(finalDomain)} ${GRAY('→')} ${YELLOW(`localhost:${serverPort}`)}`);
    console.log(GRAY('   ' + '═'.repeat(60)));

    const reqBadge = chalk.bgHex('#00f0ff').black.bold(` ↗ ${requestCount} REQS `);
    const violBadge = violationCount > 0
        ? chalk.bgRed.white.bold(` ⚠ ${violationCount} ISSUES `)
        : chalk.bgHex('#39ff14').black.bold(` ✓ CLEAN `);
    const chaosBadge = chalk.bgYellow.black.bold(` ⚡ ${chaosEvents} CHAOS `);
    console.log(`   ${reqBadge}   ${violBadge}   ${chaosBadge}`);

    console.log(GRAY('   ' + '═'.repeat(60)));
    console.log(`   ${GRAY('Press')} ${chalk.white.bold('Ctrl+C')} ${GRAY('to land (stop session)')}`);
    console.log(GRAY('   ' + '═'.repeat(60)));
    console.log('');

    // Flush pending logs
    pendingLogs.forEach(msg => console.log(`${getPrefix()} ${colorizeLog(msg)}`));
    pendingLogs.length = 0;

    // Launch Browser (pass performCleanup as onBrowserClose for graceful shutdown)
    let performCleanup: () => Promise<void>;
    let cleaningUp = false; // Guard against double cleanup

    const isStrictEnv = process.env.ATLAS_STRICT_MODE === 'true';
    const finalStrictMode = isStrictEnv || atlasConfig.strictMode || false;

    const { close, reportManager } = await launchBrowser(
        finalDomain,
        serverPort,
        projectPath,
        (msg: string) => logToTerminal(msg),
        () => { performCleanup(); },
        atlasConfig.disabledTabs || [],
        projectName,
        {
            strictMode: finalStrictMode,
            basePath: atlasConfig.basePath,
            allowedRoutes: atlasConfig.allowedRoutes,
            appUrl: atlasConfig.appUrl
        }
    );

    performCleanup = async () => {
        if (cleaningUp) return; // Prevent double execution
        cleaningUp = true;
        isLive = false;
        console.log('');
        const hr = GRAY('═'.repeat(60));
        console.log(`   ${hr}`);
        console.log(`   ${chalk.white.bold('SESSION SUMMARY')}`);
        console.log(`   ${hr}`);
        console.log(`   ${GRAY('Duration     :')} ${getUptime()}`);
        console.log(`   ${GRAY('Requests     :')} ${CYAN(String(requestCount))}`);
        console.log(`   ${GRAY('Violations   :')} ${violationCount > 0 ? chalk.redBright(String(violationCount)) : NEON_GREEN('0')}`);
        console.log(`   ${hr}`);

        if (reportManager) {
            await reportManager.flushToDisk();
            await reportManager.generateMarkdownReport();
        }

        console.log(`   ${NEON_GREEN('✓')} ${chalk.white('Reports saved to')} ${CYAN('atlas-reports/')}`);
        console.log('');

        if (serverCleanup) await serverCleanup();
        try { await close(); } catch (e) { /* Browser may already be closed */ }
        process.exit();
    };

    process.on('SIGINT', performCleanup);
}
