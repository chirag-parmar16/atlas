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

import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import url from 'url';

// Get the debug port from environment variable (avoids Electron CLI parsing conflicts)
const debugPort = parseInt(process.env.ATLAS_DEBUG_PORT || '0', 10);

// Enable remote debugging BEFORE app is ready
if (debugPort > 0) {
    app.commandLine.appendSwitch('remote-debugging-port', String(debugPort));
}

// Disable hardware acceleration for stability in headless-like environments
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('ignore-certificate-errors');

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
        title: 'Atlas',
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

    // Load local index.html with identity params
    mainWindow.loadURL(`${indexUrl}?domain=${encodeURIComponent(domain)}&port=${port}`);

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
