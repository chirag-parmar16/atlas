import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { startServer } from '../server/server';
import { launchBrowser } from '../browser/browser';

const NEON_GREEN = chalk.hex('#39ff14');
const CYAN = chalk.hex('#00f0ff');
const YELLOW = chalk.hex('#fcee0a');
const GRAY = chalk.gray;

let startTime = Date.now();
let requestCount = 0;
let violationCount = 0;
let chaosEvents = 0;
let isLive = false;

function getPrefix(): string {
    const diff = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    const time = GRAY(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    const reqs = CYAN(`${requestCount}↗`);
    const viols = violationCount > 0 ? chalk.redBright(`${violationCount}⚠`) : NEON_GREEN(`0✓`);
    return `${GRAY('[')}${time} ${GRAY('│')} ${reqs} ${GRAY('│')} ${viols}${GRAY(']')}`;
}

function getUptime(): string {
    const diff = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function isViolation(msg: string): boolean {
    const m = msg.toLowerCase();
    return /\[err\]/i.test(msg) || /error:/i.test(msg) || /\bfailed\b/i.test(m) || m.includes('violation') || m.includes('security');
}

function isRequest(msg: string): boolean {
    const m = msg.toLowerCase();
    return m.includes('200 ok') || m.includes('[fetch]') || (m.includes('request') && !m.includes('failed'));
}

function colorizeLog(msg: string): string {
    let icon = GRAY('▪');
    let color = chalk.white;
    if (msg.includes('Security')) { icon = chalk.red('█'); color = chalk.redBright; }
    else if (msg.includes('Error') || msg.includes('[ERR]')) { icon = chalk.red('▪'); color = chalk.red; }
    else if (msg.includes('Fetch') || msg.includes('OK')) { icon = chalk.green('▪'); color = chalk.green; }
    return `${icon} ${color(msg)}`;
}

async function readConsole(promptText: string): Promise<string> {
    return new Promise((resolve) => {
        process.stdout.write(promptText);
        const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
        rl.question('', (answer: string) => { rl.close(); resolve(answer.trim()); });
    });
}

export async function run() {
    const projectPath = process.cwd();
    const projectName = path.basename(projectPath);
    console.clear();

    console.log(NEON_GREEN.bold(`    ___  _____ __    ___   ____`));
    console.log(NEON_GREEN.bold(`   /   |/_  __/ /   /   | / __/`));
    console.log(NEON_GREEN.bold(`  / /| | / / / /   / /| | \\ \\  `));
    console.log(NEON_GREEN.bold(` / ___ |/ / / /___/ ___ |__/ / `));
    console.log(NEON_GREEN.bold(`/_/  |_/_/ /_____/_/  |_|___/  `) + GRAY(' v1.0.1 (Fast Boot)'));
    console.log(GRAY('   ────────────────────────────────────────────────────────'));

    const configPath = path.join(projectPath, 'atlas.config.json');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let atlasConfig: any = {};
    if (fs.existsSync(configPath)) atlasConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    const pendingLogs: string[] = [];
    const logToTerminal = (message: string) => {
        const lines = String(message).split('\n');
        for (const msg of lines) {
            const trimmed = msg.trim();
            if (!trimmed) continue;
            if (isViolation(trimmed)) violationCount++;
            else if (isRequest(trimmed)) requestCount++;
            if (isLive) console.log(`${getPrefix()} ${colorizeLog(trimmed)}`);
            else pendingLogs.push(trimmed);
        }
    };

    let serverPort = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let serverCleanup: any = null;
    let finalDomain = atlasConfig.targetDomain || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let browserClose: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let reportManager: any = null;
    let cleaningUp = false;

    const performCleanup = async () => {
        if (cleaningUp) return;
        cleaningUp = true;
        isLive = false;
        console.log(`\n   ${GRAY('═'.repeat(60))}\n   ${chalk.white.bold('SESSION SUMMARY')}\n   ${GRAY('═'.repeat(60))}`);
        console.log(`   ${GRAY('Duration     :')} ${getUptime()}`);
        console.log(`   ${GRAY('Requests     :')} ${CYAN(String(requestCount))}`);
        console.log(`   ${GRAY('Violations   :')} ${violationCount > 0 ? chalk.redBright(String(violationCount)) : NEON_GREEN('0')}\n   ${GRAY('═'.repeat(60))}`);
        if (reportManager) { await reportManager.flushToDisk(); await reportManager.generateMarkdownReport(); }
        if (serverCleanup) await serverCleanup();
        if (browserClose) try { await browserClose(); } catch (e) {}
        process.exit();
    };

    const hasPackageJson = fs.existsSync(path.join(projectPath, 'package.json'));
    const configAppUrl = atlasConfig.appUrl;

    if (configAppUrl) {
        const url = new URL(configAppUrl);
        serverPort = parseInt(url.port) || 80;
        finalDomain = atlasConfig.targetDomain || url.hostname;
    } else if (hasPackageJson) {
        if (!finalDomain) { console.error('No targetDomain in config'); process.exit(1); }
        
        const serverPromise = startServer(projectPath, logToTerminal);
        const portPromise = serverPromise.then(r => r.port);

        // --- FAST BOOT: Parallel Browser Launch ---
        console.log(YELLOW('   🚀 FAST START') + GRAY(' • Launching browser in parallel...'));
        const browserPromise = launchBrowser(finalDomain, portPromise, projectPath, logToTerminal, () => performCleanup(), atlasConfig.disabledTabs || [], projectName, atlasConfig);
        
        const serverResult = await serverPromise;
        const browserResult = await browserPromise;
        
        serverPort = serverResult.port;
        serverCleanup = serverResult.cleanup;
        browserClose = browserResult.close;
        reportManager = browserResult.reportManager;
    } else {
        // Manual Mode logic...
        if (!finalDomain) process.exit(1);
        serverPort = parseInt(await readConsole('Enter port: '));
        const browserResult = await launchBrowser(finalDomain, serverPort, projectPath, logToTerminal, () => performCleanup(), atlasConfig.disabledTabs || [], projectName, atlasConfig);
        browserClose = browserResult.close;
        reportManager = browserResult.reportManager;
    }

    isLive = true;
    startTime = Date.now();
    console.clear();
    console.log(`\n   ${NEON_GREEN('●')} ${chalk.white.bold('LIVE SESSION')}  ${GRAY('│')}  ${CYAN(finalDomain)} ${GRAY('→')} ${YELLOW(`localhost:${serverPort}`)}\n   ${GRAY('═'.repeat(60))}`);
    pendingLogs.forEach(msg => console.log(`${getPrefix()} ${colorizeLog(msg)}`));
    
    process.on('SIGINT', performCleanup);
}
