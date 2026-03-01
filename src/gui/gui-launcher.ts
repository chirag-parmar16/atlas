/**
 * Atlas GUI — Launcher
 *
 * Spawns the Electron process in GUI mode (ATLAS_MODE=GUI).
 * No Puppeteer, no CDP debug port \u2014 just the project dashboard window.
 * Called by `atlas gui` and by the no-argument default in atlas.ts.
 */

import { spawn } from 'child_process';
import path from 'path';

export async function launchGui(): Promise<void> {
    let electronBin: string;
    let electronMain: string;

    if (process.env.ATLAS_PACKAGED) {
        // Packaged: re-spawn ourselves with GUI env
        electronBin = process.execPath;
        electronMain = '';
    } else {
        try {
            electronBin = require('electron') as string;
            electronMain = path.join(__dirname, '..', 'electron', 'electron-main.js');
        } catch {
            console.error('\x1b[31m[Atlas GUI] Electron not found. Run: npm install\x1b[0m');
            process.exit(1);
        }
    }

    const envArgs = {
        ...process.env,
        ATLAS_MODE: 'GUI',
        // Ensure Electron does NOT run in Node-only mode
    };
    delete (envArgs as Record<string, string | undefined>).ELECTRON_RUN_AS_NODE;

    const spawnArgs = electronMain ? [electronMain] : [];
    const electronProcess = spawn(electronBin, spawnArgs, {
        stdio: 'ignore',
        env: envArgs,
        detached: true,
    });

    // Allow the CLI process to exit while the GUI window stays open
    electronProcess.unref();
}
