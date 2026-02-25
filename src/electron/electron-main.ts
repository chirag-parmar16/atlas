/**
 * Atlas Electron — Main Process
 * 
 * This is the Electron main process entry point.
 * Creates a frameless/kiosk BrowserWindow that serves as
 * Atlas's container — replacing the Chrome browser.
 * 
 * The remote-debugging-port is enabled so puppeteer-core
 * can connect via CDP and provide the same Page API
 * used by all Atlas Engine/Transport/UI modules.
 */

import { app, BrowserWindow, ipcMain, desktopCapturer, Event, WebContents } from 'electron';
import path from 'path';
import url from 'url';
import fs from 'fs';

// Get the debug port from environment variable (avoids Electron CLI parsing conflicts)
const debugPort = parseInt(process.env.ATLAS_DEBUG_PORT || '0', 10);
const projectName = process.env.ATLAS_PROJECT_NAME || '';

// Enable remote debugging BEFORE app is ready
if (debugPort > 0) {
    app.commandLine.appendSwitch('remote-debugging-port', String(debugPort));
}

// Disable hardware acceleration and site-isolation for stability with CDP
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('disable-site-isolation-trials');

let mainWindow: BrowserWindow | null = null;

app.on('ready', () => {
    mainWindow = new BrowserWindow({
        // Standard mode instead of kiosk to allow better window management
        kiosk: false,
        // Frameless — Atlas has its own HUD bar
        frame: false,
        // Start maximized (this will be handled after initialization)
        show: false,
        // Web preferences
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webviewTag: true,
            preload: path.join(__dirname, 'preload.js'),
            // Allow running insecure content for localhost proxying
            webSecurity: false,
        },
        // Appearance
        backgroundColor: '#111111',
        title: projectName ? `Atlas - ${projectName}` : 'Atlas',
        icon: path.join(__dirname, 'assets', 'icon.png'),
        // Start in maximized state
        autoHideMenuBar: true,
    });

    // Start maximized and then show to prevent flickering
    mainWindow.maximize();
    mainWindow.show();

    // Open DevTools for debugging UI tools failure
    // mainWindow.webContents.openDevTools({ mode: 'detach' });

    // Remove the application menu
    mainWindow.setMenu(null);

    // --- INTERCEPT _blank LINKS: Route new windows as tabs in renderer ---
    // When any webview inside Atlas tries to open a new window (target="_blank"),
    // we intercept it in the main process (the ONLY reliable place) and tell
    // the renderer to open it as a new tab instead.
    mainWindow.webContents.on('did-attach-webview', (_event: Event, webviewContents: WebContents) => {
        webviewContents.setWindowOpenHandler(({ url }: { url: string }) => {
            // Tell renderer to open as a new tab
            mainWindow?.webContents.send('open-as-tab', url);
            return { action: 'deny' }; // Block native window creation
        });
    });

    // IPC Handlers for Window Controls
    ipcMain.on('window-minimize', () => {
        mainWindow?.minimize();
    });

    ipcMain.on('window-maximize', () => {
        if (mainWindow?.isMaximized()) {
            mainWindow?.unmaximize();
        } else {
            mainWindow?.maximize();
        }
    });

    ipcMain.on('window-close', () => {
        mainWindow?.close();
    });

    // Renderer reports which tab URL is currently active
    // browser.ts reads this via a global so syncHUD can filter correctly
    ipcMain.on('active-tab-url', (_event, url: string) => {
        (global as { __atlasActiveTabUrl?: string }).__atlasActiveTabUrl = url;
    });

    // --- NATIVE SCREEN RECORDING IPC ---
    ipcMain.handle('get-window-source', async () => {
        const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
        // Find the Atlas window source. If not found, fallback to the entire screen.
        let atlasSource = sources.find(s => s.name === 'Atlas' || s.name.includes('Atlas'));
        if (!atlasSource && sources.length > 0) {
            atlasSource = sources[0]; // Fallback to primary screen
        }
        return atlasSource?.id || null;
    });

    // Active file handles for recording
    const activeRecordings = new Map<string, fs.WriteStream>();

    ipcMain.on('save-video-chunk', (event, { sessionId, buffer }: { sessionId: string, buffer: ArrayBuffer }) => {
        try {
            if (!activeRecordings.has(sessionId)) {
                const tempDir = path.join(process.cwd(), 'atlas-reports', '.temp');
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

                // Map to MP4 initially so it can be merged if needed, 
                // but the codec is usually webm. We will handle codec on Renderer side.
                const filePath = path.join(tempDir, `session-${sessionId}-native.webm`);
                const stream = fs.createWriteStream(filePath, { flags: 'a' });
                activeRecordings.set(sessionId, stream);
                console.log(`[Atlas] Native Recording Started: ${filePath}`);
            }

            const stream = activeRecordings.get(sessionId);
            if (stream) {
                stream.write(Buffer.from(buffer));
            }
        } catch (e) {
            console.error('[Atlas] Error saving video chunk', e);
        }
    });

    ipcMain.handle('finalize-video', async (event, { sessionId }: { sessionId: string }) => {
        return new Promise((resolve) => {
            try {
                const stream = activeRecordings.get(sessionId);
                if (stream) {
                    stream.end();
                    activeRecordings.delete(sessionId);

                    const tempDir = path.join(process.cwd(), 'atlas-reports', '.temp');
                    const videoDir = path.join(process.cwd(), 'atlas-reports', 'video');
                    if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });

                    const webmPath = path.join(tempDir, `session-${sessionId}-native.webm`);
                    const mp4Path = path.join(videoDir, `session-${sessionId}.mp4`);

                    console.log(`[Atlas] Finalizing Native Recording... Converting to MP4`);

                    try {
                        const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
                        const { exec } = require('child_process');

                        // Convert webm to mp4 using fast copy if possible, or re-encode if needed
                        // VP9 in webm to MP4 usually requires re-encoding or just stream copying if supported
                        const cmd = `"${ffmpegPath}" -i "${webmPath}" -c copy "${mp4Path}"`;

                        exec(cmd, (err: Error | null) => {
                            if (err) {
                                // If copy fails (codec mismatch), try re-encoding
                                console.log(`[Atlas] Direct copy failed, re-encoding to MP4...`);
                                const reencodeCmd = `"${ffmpegPath}" -i "${webmPath}" "${mp4Path}"`;
                                exec(reencodeCmd, (err2: Error | null) => {
                                    if (!err2) {
                                        console.log(`[Atlas] Native Recording Saved: ${mp4Path}`);
                                        try { fs.unlinkSync(webmPath); } catch (e) { }
                                    } else {
                                        console.error(`[Atlas] Failed to convert video:`, err2);
                                    }
                                    resolve(true);
                                });
                            } else {
                                console.log(`[Atlas] Native Recording Saved: ${mp4Path}`);
                                try { fs.unlinkSync(webmPath); } catch (e) { }
                                resolve(true);
                            }
                        });
                    } catch (e) {
                        console.error('[Atlas] FFmpeg not found, leaving as .webm', e);
                        // Fallback: move webm to video folder
                        const fallbackPath = path.join(videoDir, `session-${sessionId}-native.webm`);
                        try {
                            fs.renameSync(webmPath, fallbackPath);
                            console.log(`[Atlas] Native Recording Saved (WebM): ${fallbackPath}`);
                        } catch (err) { }
                        resolve(true);
                    }
                } else {
                    resolve(false);
                }
            } catch (e) {
                console.error('[Atlas] Error finalizing recording', e);
                resolve(false);
            }
        });
    });

    // Get domain/port from env for the HUD
    const domain = process.env.ATLAS_DOMAIN || 'unknown';
    const port = process.env.ATLAS_PORT || '0';
    // Resolve index.html path - point to Vite build output in dist/electron
    let indexPath = path.join(__dirname, '..', '..', 'electron', 'index.html');
    if (!require('fs').existsSync(indexPath)) {
        indexPath = path.join(process.cwd(), 'src', 'electron', 'index.html');
    }

    const indexUrl = url.pathToFileURL(indexPath).toString();
    console.log(`[Atlas] Loading Host HUD from: ${indexPath}`);

    const disabledTabs = process.env.ATLAS_DISABLED_TABS || '';

    // Load local index.html with identity params
    mainWindow.loadURL(`${indexUrl}?domain=${encodeURIComponent(domain)}&port=${port}&projectName=${encodeURIComponent(projectName)}&disabledTabs=${encodeURIComponent(disabledTabs)}`);

    // Handle window close
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
    app.quit();
});

// Handle process termination gracefully
process.on('SIGTERM', () => {
    app.quit();
});

process.on('SIGINT', () => {
    app.quit();
});
