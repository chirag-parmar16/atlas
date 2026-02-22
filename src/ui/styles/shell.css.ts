/**
 * Atlas UI — Shell Styles
 * 
 * Extracted from ui-shell.ts string templates.
 * Same premium CSS, now as typed constants with IDE support.
 */

/**
 * Global CSS: body push, hazard border, device mode.
 * Injected into the document <head> (outside Shadow DOM).
 */
export const SHELL_GLOBAL_CSS = `
    /* HAZARD BORDER: Fixed Overlay Frame */
    
    /* 1. Static Content Push (The Base) */
    body {
        padding-top: 60px !important;
        margin-top: 0 !important;
        position: relative;
        box-sizing: border-box;
    }

    body.atlas-hazard-mode::after {
        content: ""; pointer-events: none;
        position: fixed; top: 60px; left: 0; width: 100%; height: calc(100% - 60px);
        border: 12px solid #f59e0b;
        box-sizing: border-box;
        background: linear-gradient(135deg, #f59e0b 25%, transparent 25%) -50px 0,
                    linear-gradient(225deg, #f59e0b 25%, transparent 25%) -50px 0,
                    linear-gradient(315deg, #f59e0b 25%, transparent 25%),
                    linear-gradient(45deg, #f59e0b 25%, transparent 25%);
        background-size: 100px 100px;
        background-color: transparent;
        mask-image: linear-gradient(to bottom, transparent 12px, transparent 12px calc(100% - 12px), black calc(100% - 12px));
        -webkit-mask-image: linear-gradient(to bottom, transparent 12px, transparent 12px calc(100% - 12px), black calc(100% - 12px));
        border: 12px solid #f59e0b;
        z-index: 2147483645;
        opacity: 0.8;
    }
    
    /* DEVICE FRAME */
    body.atlas-device-mode {
        transform: scale(0.85);
        transform-origin: top center;
        border: 12px solid #18181b !important;
        border-radius: 24px !important;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
        margin: 60px auto !important;
        max-width: 390px !important; /* iPhone Pro width */
        min-height: 844px !important;
        height: auto !important;
        overflow-y: auto !important;
        background: #fff;
    }
`;

/**
 * Shell CSS: pill, menu, tabs, content panels, loading bar.
 * Injected into Shadow DOM.
 */
export const SHELL_SHADOW_CSS = `
    :host { font-family: 'Inter', system-ui, sans-serif; }
    * { box-sizing: border-box; }
    
    /* --- NPROGRESS STYLE LOADING BAR --- */
    #nprogress { pointer-events: none; }
    #nprogress .bar {
        background: #10b981; 
        position: fixed;
        z-index: 2147483648; 
        top: 0;
        left: 0;
        width: 100%;
        height: 3px;
    }
    #nprogress .peg {
        display: block;
        position: absolute;
        right: 0px;
        width: 100px;
        height: 100%;
        box-shadow: 0 0 10px #10b981, 0 0 5px #10b981;
        opacity: 1.0;
        transform: rotate(3deg) translate(0px, -4px);
    }

    .container { position: relative; display: flex; flex-direction: column; align-items: flex-end; }
    
    .pill-btn {
      background: rgba(20, 20, 20, 0.90); backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1); color: white;
      padding: 8px 16px; border-radius: 9999px; cursor: grab;
      font-weight: 600; font-size: 14px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      display: flex; align-items: center; gap: 8px; transition: transform 0.1s;
      user-select: none;
      position: relative; 
      z-index: 2;
    }
    .pill-btn:active { cursor: grabbing; transform: scale(0.98); }
    .pill-btn:hover { background: rgba(30, 30, 30, 0.95); }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981; }
    
    .menu {
      position: absolute; 
      width: 600px; height: 500px;
      background: rgba(13, 13, 13, 0.96); backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px;
      box-shadow: 0 12px 48px rgba(0,0,0,0.6);
      display: flex; flex-direction: column; 
      opacity: 0; pointer-events: none; 
      transform: scale(0.95);
      transition: opacity 0.2s, transform 0.2s;
      z-index: 1;
    }
    
    /* --- CUSTOM SCROLLBAR --- */
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 10px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
    * { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent; }
    .menu.visible { opacity: 1; pointer-events: auto; transform: scale(1); }
    
    .menu .watermark {
        position: absolute; bottom: -20px; right: -20px; width: 300px; height: 300px;
        z-index: 0; opacity: 0.03; pointer-events: none; color: #10b981;
    }

    .tabs { display: flex; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); position:relative; z-index:1; }
    .tab {
        flex: 1; padding: 10px; text-align: center; cursor: pointer; color: #fff; font-size: 12px;
        background: transparent; border: none; opacity: 0.6; transition: opacity 0.2s;
    }
    .tab:hover { opacity: 0.9; }
    .tab.active { opacity: 1; border-bottom: 2px solid #10b981; font-weight: bold; background: rgba(255,255,255,0.05); }
    
    .content { flex: 1; overflow-y: auto; padding: 12px; position: relative; z-index:1; }
    .panel { display: none; height: 100%; flex-direction: column; gap: 10px; }
    .panel.active { display: flex; }
    
    button.action-btn {
        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
        color: #eee; padding: 8px; border-radius: 6px; cursor: pointer; text-align: left;
        font-size: 13px; transition: background 0.2s;
    }
    button.action-btn:hover { background: rgba(255,255,255,0.1); }
`;

/**
 * HUD CSS: top bar, URL input, nav buttons, close button.
 * Injected into Shadow DOM.
 */
export const SHELL_HUD_CSS = `
    .hud-bar {
        position: fixed; top: 0; left: 0; width: 100%; height: 60px;
        background: rgba(13, 13, 13, 0.96); backdrop-filter: blur(12px); 
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        color: #e4e4e7; z-index: 2147483646;
        display: flex; align-items: center; gap: 0;
        padding: 0 12px;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        transform: translateY(-100%); transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .hud-bar.visible { transform: translateY(0); }
    .hud-left { display: flex; align-items: center; gap: 8px; flex-shrink: 0; padding-right: 12px; }
    .hud-live { 
        width: 8px; height: 8px; background: #10b981; 
        border-radius: 50%; box-shadow: 0 0 8px #10b981; 
        animation: pulse-live 2s infinite; 
    }
    .hud-label { font-weight: 700; color: #fff; letter-spacing: 0.5px; font-size: 13px; }
    .hud-nav-btns { display: flex; gap: 2px; }
    .hud-nav-btn {
        background: transparent; border: none; color: #71717a;
        width: 28px; height: 28px; border-radius: 6px; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        font-size: 16px; font-weight: bold; line-height: 1; transition: all 0.15s;
    }
    .hud-nav-btn:hover { background: #27272a; color: #fff; }
    .hud-url-bar {
        flex: 1; display: flex; align-items: center; gap: 8px;
        background: #18181b; border: 1px solid #27272a; border-radius: 22px;
        padding: 0 14px; height: 34px; min-width: 0;
        transition: border-color 0.2s;
    }
    .hud-url-bar:hover, .hud-url-bar:focus-within { border-color: #3f3f46; }
    .hud-url-lock { color: #10b981; font-size: 12px; flex-shrink: 0; }
    .hud-url-input {
        flex: 1; background: transparent; border: none; outline: none;
        color: #d4d4d8; font-family: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace;
        font-size: 13px; width: 100%;
    }
    .hud-url-input::placeholder { color: #52525b; }
    .hud-url-input::selection { background: #3b82f633; }
    .hud-route-tag {
        display: flex; align-items: center; gap: 6px; flex-shrink: 0;
        background: #1c1c1f; padding: 4px 10px; border-radius: 6px;
        border: 1px solid #27272a; font-size: 11px; margin-left: 8px;
    }
    .hud-route-tag .tag-domain { color: #3b82f6; font-weight: 600; font-family: monospace; }
    .hud-route-tag .tag-arrow { color: #52525b; }
    .hud-route-tag .tag-port { color: #f59e0b; font-weight: 600; font-family: monospace; }
    .hud-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; padding-left: 12px; }
    .hud-close-btn {
        background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2);
        color: #ef4444; width: 28px; height: 28px; border-radius: 6px;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        font-size: 14px; font-weight: bold; line-height: 1; transition: all 0.15s;
    }
    .hud-close-btn:hover { background: #ef4444; color: #fff; transform: scale(1.05); }
    @keyframes pulse-live { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
`;

/**
 * Pill animation CSS.
 * Injected into Shadow DOM.
 */
export const SHELL_PILL_CSS = `
    .pill-btn.pulse { animation: pulse-red 0.5s ease-in-out; }
    @keyframes pulse-red {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
    }
    .pill-btn.recording {
        border-color: rgba(239, 68, 68, 0.5);
        box-shadow: 0 0 15px rgba(239, 68, 68, 0.3);
    }
    .pill-btn.paused {
        border-color: rgba(245, 158, 11, 0.5);
        box-shadow: 0 0 15px rgba(245, 158, 11, 0.3);
    }
`;
