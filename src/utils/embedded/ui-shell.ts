
export const UI_SHELL = `
(function () {
    // SPA / Redirect Handling Check
    if (window.Atlas) {
        if (!document.getElementById('atlas-tools-host')) {
             console.log('[Atlas] Detected SPA navigation/wipe. Re-injecting UI...');
        } else {
             return;
        }
    }

    const SEVERITY = { INFO: 0, WARN: 1, ERROR: 2 };

    const __STATE__ = {
        tools: [],
        violations: [] // ALWAYS START EMPTY ON NEW PAGE
    };

    Object.defineProperty(window, '__ATLAS__', {
        value: __STATE__,
        writable: false,
        configurable: false
    });

    const ICONS = {
        CHECK: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        ALERT: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
        PAUSE: '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>',
        PLAY: '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>',
        STOP: '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"></rect></svg>',
        LOGO: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>',
        BOLT: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>'
    };

    const globalCss = \`
        /* HAZARD BORDER: Fixed Overlay Frame */
        
        /* 1. Static Content Push (The Base) */
        body {
            padding-top: 48px !important;
            position: relative;
            box-sizing: border-box;
        }

        body.atlas-hazard-mode::after {
            content: ""; pointer-events: none;
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            border: 12px solid #f59e0b;
            box-sizing: border-box;
            background: linear-gradient(135deg, #f59e0b 25%, transparent 25%) -50px 0,
                        linear-gradient(225deg, #f59e0b 25%, transparent 25%) -50px 0,
                        linear-gradient(315deg, #f59e0b 25%, transparent 25%),
                        linear-gradient(45deg, #f59e0b 25%, transparent 25%);
            background-size: 100px 100px;
            background-color: transparent;
            mask-image: linear-gradient(to bottom, black 12px, transparent 12px calc(100% - 12px), black calc(100% - 12px));
            -webkit-mask-image: linear-gradient(to bottom, black 12px, transparent 12px calc(100% - 12px), black calc(100% - 12px));
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
    \`;

    const AtlasAPI = {
        Severity: SEVERITY,
        addTool: function (name, renderCallback, onShow) {
            __STATE__.tools.push({ name, renderCallback, onShow });
        },
        reportViolation: function (source, message, level, metadata = {}) {
            const v = { 
                source, 
                message, 
                level, 
                timestamp: Date.now(),
                url: (metadata && metadata.pageUrl) || window.location.href,
                metadata
            };
            __STATE__.violations.push(v);
            
            // Send to persistent backend store
            if (window.atlasLogViolation) {
                window.atlasLogViolation(v).catch(() => {});
            }

            updateStatusIndicator(true);
            window.dispatchEvent(new CustomEvent('atlas-violation', { detail: v }));
        },
        get violations() { return __STATE__.violations; }
    };

    Object.defineProperty(window, 'Atlas', {
        value: AtlasAPI,
        writable: false,
        configurable: false
    });

    window.addEventListener('error', function (event) {
        if (window.Atlas && window.Atlas.reportViolation) {
            // Distinguish between Routine Runtime Errors and Resource Failures
            let source = 'Runtime';
            let msg = event.message;
            
            // Resource Error (404s on images/scripts/links)
            if (event.target && (event.target !== window)) {
                source = 'Resource';
                const el = event.target;
                // @ts-ignore
                const url = el.src || el.href || el.tagName;
                msg = \`Failed to load \${el.tagName}: \${url}\`;
            } else {
                 // Script Error
                 const filename = event.filename ? event.filename.split('/').pop() : 'inline';
                 if (msg) msg = \`Uncaught: \${msg} @ \${filename}:\${event.lineno}\`;
            }

            window.Atlas.reportViolation(source, msg, window.Atlas.Severity.ERROR);
        }
    }, true); // Capture phase is essential for Resource Errors (404s)

    window.addEventListener('unhandledrejection', function (event) {
        if (window.Atlas && window.Atlas.reportViolation) {
            const reason = event.reason ? (event.reason.stack || event.reason) : 'Unknown reason';
            const shortReason = String(reason).split('\\n')[0]; 
            window.Atlas.reportViolation('Promise', \`Unhandled: \${shortReason}\`, window.Atlas.Severity.WARN);
        }
    });

    let statusBtn = null;
    function updateStatusIndicator(shouldPulse = false) {
        if (!statusBtn) return;
        
        // Deduplicate (source+message)
        const seen = new Set();
        const uniqueViolations = __STATE__.violations.filter(v => {
            const key = v.source + '|' + v.message;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        
        const counts = { [SEVERITY.INFO]: 0, [SEVERITY.WARN]: 0, [SEVERITY.ERROR]: 0 };
        uniqueViolations.forEach(v => counts[v.level] = (counts[v.level] || 0) + 1);
        let color = '#10b981'; 
        let icon = ICONS.CHECK;
        if (counts[SEVERITY.ERROR] > 0) { color = '#ef4444'; icon = ICONS.ALERT; } 
        else if (counts[SEVERITY.WARN] > 0) { color = '#f59e0b'; icon = ICONS.ALERT; }
        const iconEl = statusBtn.querySelector('.icon');
        const countEl = statusBtn.querySelector('.count');
        if (iconEl && countEl) {
             iconEl.style.color = color;
             iconEl.innerHTML = icon;
             countEl.innerText = counts[SEVERITY.ERROR] + counts[SEVERITY.WARN];
        }
        if (shouldPulse) {
            statusBtn.classList.add('pulse');
            setTimeout(() => statusBtn.classList.remove('pulse'), 500);
        }
    }

    const css = \`
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
          background: rgba(20, 20, 20, 0.95); backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
          display: flex; flex-direction: column; overflow: hidden;
          opacity: 0; pointer-events: none; 
          transform: scale(0.95);
          transition: opacity 0.2s, transform 0.2s;
          z-index: 1;
        }
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
    \`;

    // --- LOADING BAR CONTROLLER ---
    const Loader = {
        state: 0,
        timer: null,
        el: null,
        render: function(shadowRoot) {
             const div = document.createElement('div');
             div.id = 'nprogress';
             div.innerHTML = '<div class="bar" role="bar"><div class="peg"></div></div>';
             div.style.display = 'none';
             div.style.transition = 'opacity 0.2s';
             shadowRoot.appendChild(div);
             this.el = div;
        },
        start: function() {
            if (!this.el) return;
            if (this.state === 0) {
                this.state = 0.1; 
                this.el.style.display = 'block';
                this.el.style.opacity = '1';
                this.update(0.1);
            }
            if (!this.timer) {
                this.timer = setInterval(() => { this.inc(); }, 300);
            }
        },
        inc: function() {
             if (this.state >= 0.9) return;
             const amount = 0.05 * Math.random();
             this.update(this.state + amount);
        },
        update: function(n) {
             this.state = n;
             const bar = this.el.querySelector('.bar');
             if (bar) {
                 bar.style.transform = \`translate3d(-\${(1 - n) * 100}%, 0, 0)\`;
                 bar.style.transition = 'all 200ms ease';
             }
        },
        done: function() {
            if (!this.el) return;
            this.update(1);
            if (this.timer) { clearInterval(this.timer); this.timer = null; }
            setTimeout(() => {
                this.el.style.opacity = '0';
                setTimeout(() => {
                    this.el.style.display = 'none';
                    this.state = 0;
                    this.update(0);
                }, 200);
            }, 300);
        }
    };

    const initShell = () => {
        if (document.getElementById('atlas-tools-host')) return;
        const host = document.createElement('div');
        host.id = 'atlas-tools-host';
        host.style.position = 'fixed'; 
        host.style.bottom = '20px'; host.style.right = '20px'; host.style.zIndex = '2147483647';
        
        // [REVERT] Inject into body (standard), but use aggressive persistence
        const mount = () => {
            if (document.body) {
                document.body.appendChild(host);
                console.log('[Atlas] UI Shell injected into BODY.');
            } else if (document.documentElement) {
                document.documentElement.appendChild(host);
            }
        };
        mount();

        // --- LAYOUT ENFORCER (Strict Fix) ---
        const enforceLayout = () => {
             if (!document.body) return;
             const nodes = [
                 ...Array.from(document.body.children),
                 ...Array.from(document.querySelectorAll('header, nav, .fixed, [style*="fixed"]'))
             ];
             nodes.forEach(el => {
                 if (el === host || el.id === 'atlas-tools-host') return;
                 if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
                 const style = window.getComputedStyle(el);
                 if (style.position === 'fixed' || style.position === 'sticky') {
                     const top = parseInt(style.top);
                     if (!isNaN(top) && top < 40) {
                         if (!el.dataset.atlasShifted) {
                             el.style.top = (top + 48) + 'px';
                             el.dataset.atlasShifted = 'true';
                         }
                     } else if (style.top === 'auto' && style.bottom === 'auto') {
                         el.style.top = '48px';
                         el.dataset.atlasShifted = 'true';
                     }
                 }
             });
        };

        const observer = new MutationObserver((mutations) => {
            // Re-inject if missing
            if (!document.body.contains(host)) { 
                console.log('[Atlas] UI Shell removed (hydration?). Re-injecting...');
                mount();
            }
        });
        observer.observe(document.body, { childList: true, subtree: false });

        setInterval(() => {
            // Aggressive Persistence Check (Backup for Observer)
            if (document.body && !document.body.contains(host)) { 
                try { mount(); } catch(e) {} 
            }

            if (document.body) {
                const isDevice = document.body.classList.contains('atlas-device-mode');
                const isHazard = document.body.classList.contains('atlas-hazard-mode');
                if (!isDevice && !isHazard) { document.body.classList.add('atlas-hazard-mode'); }
                enforceLayout();
            }
        }, 500);

        const shadow = host.attachShadow({ mode: 'open' });
        
        // Initialize Loader
        Loader.render(shadow);
        // @ts-ignore
        window.Atlas.startLoading = () => Loader.start();
        // @ts-ignore
        window.Atlas.stopLoading = () => Loader.done();

        const style = document.createElement('style');
        style.textContent = css;
        shadow.appendChild(style);

        const hudStyle = document.createElement('style');
        hudStyle.textContent = \`
            .hud-bar {
                position: fixed; top: 0; left: 0; width: 100%; height: 44px;
                background: #0a0a0a; border-bottom: 1px solid #1f1f23;
                color: #e4e4e7; z-index: 2147483646;
                display: flex; align-items: center; gap: 0;
                padding: 0 12px;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 13px;
                box-shadow: 0 2px 16px rgba(0,0,0,0.6);
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
                padding: 0 14px; height: 30px; min-width: 0;
                transition: border-color 0.2s;
            }
            .hud-url-bar:hover { border-color: #3f3f46; }
            .hud-url-lock { color: #10b981; font-size: 12px; flex-shrink: 0; }
            .hud-url-text {
                flex: 1; color: #a1a1aa; font-family: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace;
                font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                user-select: all;
            }
            .hud-url-text .url-domain { color: #e4e4e7; font-weight: 500; }
            .hud-url-text .url-path { color: #71717a; }
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
        \`;
        shadow.appendChild(hudStyle);

        if (!document.getElementById('atlas-global-style')) {
            const gStyle = document.createElement('style');
            gStyle.id = 'atlas-global-style';
            gStyle.textContent = globalCss;
            document.head.appendChild(gStyle);
        }

        // Read persisted config from evaluateOnNewDocument
        const config = window.__ATLAS_CONFIG__ || {};
        const fakeDomain = config.domain || '...';
        const realPort = config.port || '...';

        const hud = document.createElement('div');
        hud.className = 'hud-bar visible';
        hud.innerHTML = \`
            <div class="hud-left">
                <div class="hud-nav-btns">
                    <button class="hud-nav-btn" id="hud-back-btn" title="Go Back">‹</button>
                    <button class="hud-nav-btn" id="hud-fwd-btn" title="Go Forward">›</button>
                </div>
                <div class="hud-live"></div>
                <span class="hud-label">ATLAS</span>
            </div>
            <div class="hud-url-bar">
                <span class="hud-url-lock">🔒</span>
                <span class="hud-url-text" id="hud-url-text">
                    <span class="url-domain">\${fakeDomain}</span><span class="url-path">/</span>
                </span>
            </div>
            <div class="hud-route-tag">
                <span class="tag-domain">\${fakeDomain}</span>
                <span class="tag-arrow">→</span>
                <span class="tag-port">:\${realPort}</span>
            </div>
            <div class="hud-right">
                <button class="hud-close-btn" id="hud-close-btn" title="Stop Atlas Session">✕</button>
            </div>
        \`;
        shadow.appendChild(hud);

        // --- URL Bar Live Update ---
        const urlTextEl = shadow.querySelector('#hud-url-text');
        const updateUrlBar = () => {
            if (!urlTextEl) return;
            try {
                const url = new URL(window.location.href);
                const domain = url.hostname;
                const pathAndQuery = url.pathname + url.search + url.hash;
                urlTextEl.innerHTML = '<span class="url-domain">' + domain + '</span><span class="url-path">' + pathAndQuery + '</span>';
            } catch(e) {
                urlTextEl.textContent = window.location.href;
            }
        };
        updateUrlBar();
        window.addEventListener('hashchange', updateUrlBar);
        window.addEventListener('popstate', updateUrlBar);
        // Observe SPA pushState changes
        const origPush = history.pushState;
        history.pushState = function() {
            // @ts-ignore
            origPush.apply(this, arguments);
            setTimeout(updateUrlBar, 50);
        };
        const origReplace = history.replaceState;
        history.replaceState = function() {
            // @ts-ignore
            origReplace.apply(this, arguments);
            setTimeout(updateUrlBar, 50);
        };

        // --- Button Handlers ---
        const closeBtn = shadow.querySelector('#hud-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (window.atlasCloseBrowser) window.atlasCloseBrowser();
                else window.close();
            });
        }
        const backBtn = shadow.querySelector('#hud-back-btn');
        const fwdBtn = shadow.querySelector('#hud-fwd-btn');
        if (backBtn) backBtn.addEventListener('click', () => { if (window.atlasGoBack) window.atlasGoBack(); else history.back(); });
        if (fwdBtn) fwdBtn.addEventListener('click', () => { if (window.atlasGoForward) window.atlasGoForward(); else history.forward(); });

        // UpdateHUD still available for manual override
        window.Atlas.updateHUD = (fd, rp) => {
            const tagDomain = shadow.querySelector('.tag-domain');
            const tagPort = shadow.querySelector('.tag-port');
            if (tagDomain) tagDomain.textContent = fd;
            if (tagPort) tagPort.textContent = ':' + rp;
        };

        // --- Fullscreen Lock ---
        // Prevent ESC and F11 from exiting fullscreen
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.key === 'F11') {
                e.preventDefault();
                e.stopPropagation();
                // Show warning toast
                let toast = shadow.querySelector('.atlas-fs-toast');
                if (!toast) {
                    toast = document.createElement('div');
                    toast.className = 'atlas-fs-toast';
                    toast.style.cssText = 'position:fixed;top:56px;left:50%;transform:translateX(-50%);background:#1c1917;color:#fbbf24;padding:8px 20px;border-radius:8px;font-size:12px;font-family:Inter,sans-serif;border:1px solid #422006;z-index:2147483647;opacity:0;transition:opacity 0.3s;pointer-events:none;';
                    shadow.appendChild(toast);
                }
                toast.textContent = '⚠ Fullscreen mode is locked during Atlas session';
                toast.style.opacity = '1';
                setTimeout(() => { toast.style.opacity = '0'; }, 2500);
                // Re-enter fullscreen if exited
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => {});
                }
                return false;
            }
        }, true);

window.Atlas.toggleDeviceMode = (enabled) => {
    if (enabled) {
        document.documentElement.classList.add('atlas-device-wrapper');
        document.body.classList.add('atlas-device-mode');
    } else {
        document.documentElement.classList.remove('atlas-device-wrapper');
        document.body.classList.remove('atlas-device-mode');
    }
};

document.body.classList.add('atlas-hazard-mode');

const container = document.createElement('div');
container.className = 'container';
const menu = document.createElement('div');
menu.className = 'menu';

const watermark = document.createElement('div');
watermark.className = 'watermark';
watermark.innerHTML = ICONS.LOGO.replace('width="18"', 'width="100%"').replace('height="18"', 'height="100%"');
menu.appendChild(watermark);

const tabs = document.createElement('div');
tabs.className = 'tabs';
menu.appendChild(tabs);

const content = document.createElement('div');
content.className = 'content';
menu.appendChild(content);

__STATE__.tools.forEach((tool, index) => {
    const btn = document.createElement('button');
    btn.className = 'tab';
    btn.innerText = tool.name;
    btn.onclick = () => switchTab(tool.name);
    tabs.appendChild(btn);

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.id = 'panel-' + tool.name;
    if (tool.renderCallback) {
        const el = tool.renderCallback();
        if (el) panel.appendChild(el);
    }
    content.appendChild(panel);

    if (tabs.children.length === 1) {
        btn.classList.add('active');
        panel.classList.add('active');
    }
});

const mainBtn = document.createElement('button');
mainBtn.className = 'pill-btn';
mainBtn.innerHTML = \`<span style="margin-right:6px; color:#10b981; display:flex;">\${ICONS.LOGO}</span> Atlas <span class="icon" style="margin-left:8px; color:#10b981; display:flex;">\${ICONS.CHECK}</span> <span class="count" style="margin-left:4px; font-family:monospace; opacity:0.8">0</span>\`;
        statusBtn = mainBtn;

        let recordingTimer = null;
        let accumulatedMs = 0;
        let segmentStartTime = null; 
        let isPaused = false;

        window.Atlas.setRecordingState = (isActive) => {
            if (isActive) {
                accumulatedMs = 0;
                segmentStartTime = Date.now();
                isPaused = false;
                mainBtn.classList.add('recording');
                menu.classList.remove('visible'); 
                updateTimer();
                recordingTimer = setInterval(updateTimer, 1000);
            } else {
                mainBtn.classList.remove('recording');
                clearInterval(recordingTimer);
                recordingTimer = null;
                accumulatedMs = 0;
                segmentStartTime = null;
                isPaused = false;
                mainBtn.innerHTML = \`<span style="margin-right:6px; color:#10b981; display:flex;">\${ICONS.LOGO}</span> Atlas <span class="icon" style="margin-left:8px; color:#10b981; display:flex;">\${ICONS.CHECK}</span> <span class="count" style="margin-left:4px; font-family:monospace; opacity:0.8">0</span>\`;
                updateStatusIndicator(); 
            }
        };

        function updateTimer() {
            if (!recordingTimer && !isPaused) return;
            let currentTotalMs = accumulatedMs;
            if (!isPaused && segmentStartTime) {
                currentTotalMs += (Date.now() - segmentStartTime);
            }
            const diff = Math.floor(currentTotalMs / 1000);
            const m = Math.floor(diff / 60).toString().padStart(2, '0');
            const s = Math.floor(diff % 60).toString().padStart(2, '0');
            const statusColor = isPaused ? '#f59e0b' : '#ef4444';
            const statusText = isPaused ? 'PAUSED' : 'REC';
            const pauseIcon = isPaused ? ICONS.PLAY : ICONS.PAUSE;
            
            let html = '<span style="color:' + statusColor + '; margin-right:6px;">●</span> ' + statusText + ' ' + m + ':' + s; 
            html += '<button id="pill-pause-btn" style="margin-left:8px; background:rgba(255,255,255,0.1); border:none; color:white; border-radius:4px; padding:2px 8px; cursor:pointer; font-size:12px; display:flex; align-items:center;">' + pauseIcon + '</button>';
            html += '<button id="pill-stop-btn" style="margin-left:4px; background:rgba(255,50,50,0.3); border:none; color:white; border-radius:4px; padding:2px 6px; cursor:pointer; font-size:10px; display:flex; align-items:center;">' + ICONS.STOP + '</button>';
            mainBtn.innerHTML = html;
            
            const stopBtn = mainBtn.querySelector('#pill-stop-btn');
            if (stopBtn) {
                stopBtn.onclick = (e) => {
                    e.stopPropagation();
                    clearInterval(recordingTimer);
                    mainBtn.innerHTML = '<span style="color:#ef4444;">⏳ Stopping...</span>';
                    window.dispatchEvent(new CustomEvent('atlas-stop-recording'));
                };
            }
            const pauseBtn = mainBtn.querySelector('#pill-pause-btn');
            if (pauseBtn) {
                pauseBtn.onclick = (e) => {
                    e.stopPropagation();
                    isPaused = !isPaused;
                    if (isPaused) {
                        if (segmentStartTime) {
                            accumulatedMs += (Date.now() - segmentStartTime);
                            segmentStartTime = null;
                        }
                    } else {
                        segmentStartTime = Date.now();
                    }
                    mainBtn.classList.toggle('paused', isPaused);
                    updateTimer(); 
                    window.dispatchEvent(new CustomEvent('atlas-toggle-pause', { detail: { paused: isPaused } }));
                };
            }
        }

        const pulseStyle = document.createElement('style');
        pulseStyle.textContent = \`
            .pill-btn.pulse { animation: pulse-red 0.5s ease-in-out; }
            @keyframes pulse-red {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }
        \`;
        shadow.appendChild(pulseStyle);

        container.appendChild(menu);
        container.appendChild(mainBtn);
        shadow.appendChild(container);

        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
        mainBtn.addEventListener('mousedown', (e) => {
            const rect = host.getBoundingClientRect();
            host.style.bottom = 'auto';
            host.style.right = 'auto';
            host.style.left = rect.left + 'px';
            host.style.top = rect.top + 'px';
            initialLeft = rect.left;
            initialTop = rect.top;
            startX = e.clientX;
            startY = e.clientY;
            isDragging = false;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        function onMouseMove(e) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (!isDragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
                isDragging = true;
                menu.classList.remove('visible');
            }
            if (isDragging) {
                e.preventDefault();
                host.style.left = (initialLeft + dx) + 'px';
                host.style.top = (initialTop + dy) + 'px';
            }
        }

        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            updateQuadrant(); 
            saveState(); 
            setTimeout(() => { isDragging = false; }, 50);
        }

        function updateQuadrant() {
            const rect = mainBtn.getBoundingClientRect();
            const winW = window.innerWidth;
            const winH = window.innerHeight;
            const isRightHalf = rect.left > winW / 2;
            const isBottomHalf = rect.top > winH / 2;
            const gap = '12px';
            menu.style.top = '';
            menu.style.bottom = '';
            menu.style.left = '';
            menu.style.right = '';
            if (isBottomHalf) { menu.style.bottom = \`calc(100% + \${gap})\`; } else { menu.style.top = \`calc(100% + \${gap})\`; }
            if (isRightHalf) { menu.style.right = '0'; } else { menu.style.left = '0'; }
        }

        function switchTab(name) {
            const allTabs = tabs.querySelectorAll('.tab');
            allTabs.forEach(t => { t.classList.toggle('active', t.innerText === name); });
            const allPanels = content.querySelectorAll('.panel');
            allPanels.forEach(p => { p.classList.toggle('active', p.id === \`panel-\${name}\`); });
            const tool = __STATE__.tools.find(t => t.name === name);
            if (tool && tool.onShow) tool.onShow();
            const visible = menu.classList.contains('visible');
            sessionStorage.setItem('atlas-ui-state', JSON.stringify({ visible, activeTab: name }));
        }

        const savedState = sessionStorage.getItem('atlas-ui-state');
        if (savedState) {
            try {
                const s = JSON.parse(savedState);
                if (s.visible) menu.classList.add('visible');
                if (s.activeTab) switchTab(s.activeTab);
                if (s.x && s.y) {
                    host.style.bottom = 'auto';
                    host.style.right = 'auto';
                    host.style.left = s.x;
                    host.style.top = s.y;
                }
            } catch (e) { }
        }

        const saveState = () => {
             const visible = menu.classList.contains('visible');
             const activeTabBtn = tabs.querySelector('.tab.active');
             const activeTab = activeTabBtn ? activeTabBtn.innerText : null;
             const rect = host.getBoundingClientRect();
             const x = rect.left + 'px';
             const y = rect.top + 'px';
             sessionStorage.setItem('atlas-ui-state', JSON.stringify({ visible, activeTab, x, y }));
        };

        mainBtn.addEventListener('click', (e) => {
            if (isDragging) return;
            const isVisible = menu.classList.contains('visible');
            if (isVisible) menu.classList.remove('visible');
            else { updateQuadrant(); menu.classList.add('visible'); }
            saveState(); 
        });
        
        updateQuadrant();

        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.code === 'Space') {
                e.preventDefault();
                if (host.classList.contains('stealth')) {
                    host.classList.remove('stealth');
                } else {
                    host.classList.add('stealth');
                }
            }
        });
    };
    
    // --- VIOLATION SYNC ENGINE ---
    let __lastSyncedUrl__ = window.location.href;
    const syncViolationsFromBackend = async () => {
        try {
            // Clear violations on SPA navigation (URL changed)
            const currentUrl = window.location.href;
            if (currentUrl !== __lastSyncedUrl__) {
                __STATE__.violations.length = 0;
                __lastSyncedUrl__ = currentUrl;
            }

            const prevCount = __STATE__.violations.length;

            // 1. Process queued violations (from before Atlas was ready)
            if (window.__ATLAS_VIOLATION_QUEUE__ && window.__ATLAS_VIOLATION_QUEUE__.length > 0) {
                window.__ATLAS_VIOLATION_QUEUE__.forEach(v => {
                    const exists = __STATE__.violations.some(ex => 
                        ex.source === v.source && ex.message === v.message && ex.timestamp === v.timestamp
                    );
                    if (!exists) {
                        __STATE__.violations.push(v);
                    }
                });
                window.__ATLAS_VIOLATION_QUEUE__ = [];
            }

            // 2. Sync from backend violation history (survives page navigations)
            if (window.getFullViolationHistory) {
                const history = await window.getFullViolationHistory();
                if (history && history.length > 0) {
                    history.forEach(v => {
                        const exists = __STATE__.violations.some(ex => 
                            ex.source === v.source && ex.message === v.message && ex.timestamp === v.timestamp
                        );
                        if (!exists) {
                            __STATE__.violations.push(v);
                        }
                    });
                }
            }

            // 3. Process network queue
            if (window.__ATLAS_NETWORK_QUEUE__ && window.__ATLAS_NETWORK_QUEUE__.length > 0) {
                window.__ATLAS_NETWORK_QUEUE__.forEach(d => {
                    if (window.Atlas && window.Atlas.logNetworkRequest) window.Atlas.logNetworkRequest(d);
                });
                window.__ATLAS_NETWORK_QUEUE__ = [];
            }

            // Only update UI if violations changed
            if (__STATE__.violations.length !== prevCount) {
                updateStatusIndicator(true);
                window.dispatchEvent(new CustomEvent('atlas-violation'));
            }
        } catch(e) {
            // Sync failed silently - will retry
        }
    };

    try {
        console.log('[Atlas] 🚀 Bootstrapping UI Shell...');
        const bootstrap = () => {
            if (document.body) {
                initShell();
                // Initial sync after 500ms (wait for exposed functions)
                setTimeout(syncViolationsFromBackend, 500);
                // Periodic sync to keep pill count accurate
                setInterval(syncViolationsFromBackend, 3000);
            } else {
                requestAnimationFrame(bootstrap);
            }
        };

        if (document.readyState === 'loading') {
            window.addEventListener('DOMContentLoaded', bootstrap);
        } else {
            bootstrap(); 
        }
    } catch (e) {
        console.error('[Atlas] Bootstrap Failed:', e);
    }

})();
`;