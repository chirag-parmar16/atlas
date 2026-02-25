if (process.env.ATLAS_GUI_MODE === 'true') {
    // We are running as the Electron GUI process
    require('./dist/src/electron/electron-main.js');
} else {
    // If double-clicked directly by the user, warn them to use CLI
    const { app, dialog } = require('electron');
    app.whenReady().then(() => {
        dialog.showMessageBoxSync({
            type: 'info',
            title: 'Atlas Sandbox',
            message: 'Atlas is a CLI tool. Please open your terminal (Command Prompt, PowerShell, Git Bash) and type "atlas init" or "atlas run".'
        });
        app.quit();
    });
}
