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

import { app, BrowserWindow } from 'electron';

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
        // Kiosk mode — matches current Chrome --kiosk behavior
        kiosk: true,
        // Frameless — Atlas has its own HUD bar
        frame: false,
        // Full screen by default
        fullscreen: false,
        // Start maximized
        show: true,
        // Web preferences
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            // Allow running insecure content for localhost proxying
            webSecurity: false,
        },
        // Appearance
        backgroundColor: '#111111',
        title: 'Atlas',
        // Start in maximized state (kiosk will override this)
        autoHideMenuBar: true,
    });

    // Remove the application menu
    mainWindow.setMenu(null);

    // Load about:blank — Puppeteer will navigate
    mainWindow.loadURL('about:blank');

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
