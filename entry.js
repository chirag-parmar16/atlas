/**
 * Atlas Packaged Entry Point
 *
 * When the installed .exe is launched:
 *   - With ATLAS_MODE=SANDBOX (set by `atlas run`) → load sandbox HUD
 *   - With ATLAS_MODE=GUI (set by `atlas gui`) → load GUI dashboard
 *   - Double-clicked with NO args → default to GUI dashboard (no more CLI popup)
 */

// Resolve mode: support both old ATLAS_GUI_MODE and new ATLAS_MODE
const mode = process.env.ATLAS_MODE
    || (process.env.ATLAS_GUI_MODE === 'true' ? 'SANDBOX' : 'GUI');

process.env.ATLAS_MODE = mode;
require('./dist/src/electron/electron-main.js');
