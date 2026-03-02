/**
 * Atlas GUI — Project Scanner & File IPC Handlers
 *
 * Provides ipcMain handlers for the GUI dashboard:
 *   scan-projects(rootPath)     → finds folders with atlas.config.json
 *   get-report-files(projectPath) → lists .md and .mp4 files in atlas-report/
 *   read-file(filePath)         → reads text content for Markdown rendering
 *
 * Register by calling registerScannerHandlers(ipcMain) from electron-main.ts.
 */

import { ipcMain, app } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface ProjectInfo {
    name: string;
    path: string;
    config: Record<string, unknown>;
    hasReports: boolean;
    reportCount: number;
}

export interface ReportFile {
    name: string;
    path: string;
    type: 'md' | 'mp4' | 'webm';
    size: number;
    modified: number;
}

/**
 * Walk a directory tree up to `maxDepth` levels to find atlas.config.json files.
 * Returns immediately if it finds one in a folder (does not recurse into that subtree).
 */
function walkForProjects(dir: string, depth: number, maxDepth: number, results: ProjectInfo[]): void {
    if (depth > maxDepth) return;

    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
        return; // Permission denied or not a directory
    }

    const configFile = entries.find(e => e.isFile() && e.name === 'atlas.config.json');
    if (configFile) {
        try {
            const configPath = path.join(dir, 'atlas.config.json');
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;

            // Support both atlas-report (legacy) and atlas-reports (new)
            const reportDir = fs.existsSync(path.join(dir, 'atlas-reports'))
                ? path.join(dir, 'atlas-reports')
                : path.join(dir, 'atlas-report');

            let hasReports = false;
            let reportCount = 0;

            if (fs.existsSync(reportDir)) {
                // Count recursively (reports may be in markdown/ json/ subfolders)
                const countFiles = (d: string): number => {
                    let count = 0;
                    try {
                        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
                            if (e.isDirectory()) { count += countFiles(path.join(d, e.name)); continue; }
                            const ext = path.extname(e.name).toLowerCase();
                            if (ext === '.md' || ext === '.mp4' || ext === '.webm') count++;
                        }
                    } catch (_) { }
                    return count;
                };
                reportCount = countFiles(reportDir);
                hasReports = reportCount > 0;
            }

            results.push({
                name: path.basename(dir),
                path: dir,
                config,
                hasReports,
                reportCount
            });
        } catch (_) { /* Malformed config — skip */ }
        return;
    }

    // Recurse into subdirectories, skipping hidden folders and node_modules
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const name = entry.name;
        if (name.startsWith('.') || name === 'node_modules' || name === '__pycache__' || name === '.git') continue;
        walkForProjects(path.join(dir, name), depth + 1, maxDepth, results);
    }
}

export function registerScannerHandlers(): void {
    // Scan for Atlas projects across multiple roots
    ipcMain.handle('scan-projects', async (_event, rootPath?: string) => {
        const results: ProjectInfo[] = [];
        const seen = new Set<string>();

        const scanRoot = (root: string) => {
            if (seen.has(root)) return;
            seen.add(root);
            walkForProjects(root, 0, 3, results);
        };

        if (rootPath) {
            // Explicit root given (e.g. from Browse button)
            scanRoot(rootPath);
        } else {
            // 1. Always scan home dir (C:\Users\username)
            scanRoot(os.homedir());

            // 2. On Windows: scan root of all available drives (C:\ through Z:\)
            if (process.platform === 'win32') {
                for (let c = 'C'.charCodeAt(0); c <= 'Z'.charCodeAt(0); c++) {
                    const drive = String.fromCharCode(c) + ':\\';
                    if (drive === os.homedir().slice(0, 3)) continue; // already scanned via homedir
                    if (fs.existsSync(drive)) {
                        scanRoot(drive);
                    }
                }
            } else {
                // macOS / Linux: scan common project roots
                const extras = [
                    path.join(os.homedir(), 'Projects'),
                    path.join(os.homedir(), 'projects'),
                    path.join(os.homedir(), 'Dev'),
                    path.join(os.homedir(), 'dev'),
                    path.join(os.homedir(), 'work'),
                    path.join(os.homedir(), 'Desktop'),
                ];
                extras.forEach(p => { if (fs.existsSync(p)) scanRoot(p); });
            }
        }

        // Deduplicate by path
        const unique = Array.from(new Map(results.map(r => [r.path, r])).values());
        return unique;
    });

    // List report files for a given project (.md and .mp4 only)
    ipcMain.handle('get-report-files', (_event, projectPath: string) => {
        // Support both atlas-report (legacy) and atlas-reports (new)
        const reportDir = fs.existsSync(path.join(projectPath, 'atlas-reports'))
            ? path.join(projectPath, 'atlas-reports')
            : path.join(projectPath, 'atlas-report');

        const files: ReportFile[] = [];

        if (!fs.existsSync(reportDir)) return files;

        const walk = (dir: string, prefix: string = '') => {
            let entries: fs.Dirent[];
            try {
                entries = fs.readdirSync(dir, { withFileTypes: true });
            } catch (_) { return; }

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const displayName = prefix ? `${prefix}/${entry.name}` : entry.name;

                if (entry.isDirectory()) {
                    // Recurse into subdirectories (e.g. video/ subfolder)
                    walk(fullPath, displayName);
                    continue;
                }

                const ext = path.extname(entry.name).toLowerCase();
                if (ext !== '.md' && ext !== '.mp4' && ext !== '.webm') continue;

                let stat: fs.Stats;
                try { stat = fs.statSync(fullPath); } catch (_) { continue; }

                files.push({
                    name: displayName,
                    path: fullPath,
                    type: ext.slice(1) as 'md' | 'mp4' | 'webm',
                    size: stat.size,
                    modified: stat.mtimeMs
                });
            }
        };

        walk(reportDir);
        // Sort: .md files first, then videos, both sorted by name
        files.sort((a, b) => {
            if (a.type === 'md' && b.type !== 'md') return -1;
            if (a.type !== 'md' && b.type === 'md') return 1;
            return a.name.localeCompare(b.name);
        });

        return files;
    });

    // Read a text file for Markdown rendering
    // Security: only allow reading .md files (no arbitrary file reads)
    // Audit Fix: Implement Path Traversal protection
    ipcMain.handle('read-file', (_event, filePath: string) => {
        const resolved = path.resolve(filePath);

        // Ensure path is within the project's report directories
        const isReportDir = resolved.includes('atlas-report') || resolved.includes('atlas-reports');
        if (!isReportDir) {
            console.error(`[Atlas Security] Blocked attempt to read file outside report directory: ${resolved}`);
            throw new Error('[Atlas Security] Access Denied: Cannot read files outside of project report directories');
        }

        const ext = path.extname(resolved).toLowerCase();
        if (ext !== '.md' && ext !== '.txt') {
            throw new Error('[Atlas] Only .md and .txt files can be read');
        }

        if (!fs.existsSync(resolved)) {
            throw new Error(`[Atlas] File not found: ${resolved}`);
        }

        return fs.readFileSync(resolved, 'utf-8');
    });

    // Open a native folder picker and return the selected path
    ipcMain.handle('browse-folder', async (event) => {
        const { dialog, BrowserWindow } = await import('electron');
        const win = BrowserWindow.fromWebContents(event.sender);
        const result = await dialog.showOpenDialog(win!, {
            title: 'Select a folder to scan for Atlas projects',
            properties: ['openDirectory']
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        return result.filePaths[0];
    });
}
