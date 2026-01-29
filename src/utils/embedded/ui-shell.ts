export const UI_SHELL = `
(function () {
    if (window.Atlas) return;

    // Severity Enum
    const SEVERITY = { INFO: 0, WARN: 1, ERROR: 2 };

    // Internal Protected State
    const __STATE__ = {
        tools: [],
        violations: []
    };

    // Expose State for extraction (Namespace)
    Object.defineProperty(window, '__ATLAS__', {
        value: __STATE__,
        writable: false,
        configurable: false
    });

    // --- ICONS ---
    const ICONS = {
        CHECK: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        ALERT: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
        PAUSE: '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>',
        PLAY: '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>',
        STOP: '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"></rect></svg>',
        LOGO: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>',
        BOLT: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>'
    };


    // Public Controlled API
    const AtlasAPI = {
        Severity: SEVERITY,
        
        addTool: function (name, renderCallback, onShow) {
            __STATE__.tools.push({ name, renderCallback, onShow });
        },

        reportViolation: function (source, message, level) {
            const v = { source, message, level, timestamp: Date.now() };
            __STATE__.violations.push(v);
            updateStatusIndicator(); // Defined later
            window.dispatchEvent(new CustomEvent('atlas-violation', { detail: v }));
        },

        get violations() {
            return __STATE__.violations;
        }
    };

    // Lock global API
    Object.defineProperty(window, 'Atlas', {
        value: AtlasAPI,
        writable: false,
        configurable: false
    });

    // --- Global Error Handlers ---
    window.addEventListener('error', function (event) {
        if (window.Atlas && window.Atlas.reportViolation) {
            // Shorten URL to just filename
            const filename = event.filename ? event.filename.split('/').pop() : 'inline';
            const txt = \`Uncaught: \${event.message} @ \${filename}:\${event.lineno}\`;
            window.Atlas.reportViolation('Runtime', txt, window.Atlas.Severity.ERROR);
        }
    });

    window.addEventListener('unhandledrejection', function (event) {
        if (window.Atlas && window.Atlas.reportViolation) {
            const reason = event.reason ? (event.reason.stack || event.reason) : 'Unknown reason';
            // Truncate long stacks
            const shortReason = String(reason).split('\\n')[0]; 
            window.Atlas.reportViolation('Promise', \`Unhandled: \${shortReason}\`, window.Atlas.Severity.WARN);
        }
    });

    // --- UI Helpers ---
    let statusBtn = null;
    
    function updateStatusIndicator() {
        if (!statusBtn) return;
        
        const counts = { [SEVERITY.INFO]: 0, [SEVERITY.WARN]: 0, [SEVERITY.ERROR]: 0 };
        __STATE__.violations.forEach(v => counts[v.level] = (counts[v.level] || 0) + 1);

        // Determine Status Color
        let color = '#10b981'; // Green
        let icon = ICONS.CHECK;
        
        if (counts[SEVERITY.ERROR] > 0) {
            color = '#ef4444'; // Red
            icon = ICONS.ALERT;
        } else if (counts[SEVERITY.WARN] > 0) {
            color = '#f59e0b'; // Yellow
            icon = ICONS.ALERT;
        }

        const iconEl = statusBtn.querySelector('.icon');
        const countEl = statusBtn.querySelector('.count');
        
        if (iconEl && countEl) {
             iconEl.style.color = color;
             iconEl.innerHTML = icon;
             countEl.innerText = counts[SEVERITY.ERROR] + counts[SEVERITY.WARN];
        }

        
        // Pulse effect on new violation
        statusBtn.classList.add('pulse');
        setTimeout(() => statusBtn.classList.remove('pulse'), 500);
    }

    // Load CSS
    const css = \`
        :host { font-family: 'Inter', system-ui, sans-serif; }
        * { box-sizing: border-box; }
        /* Container is relative so absolute menu positions against it */
        .container { position: relative; display: flex; flex-direction: column; align-items: flex-end; }
        
        .pill-btn {
          background: rgba(20, 20, 20, 0.90); backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1); color: white;
          padding: 8px 16px; border-radius: 9999px; cursor: grab;
          font-weight: 600; font-size: 14px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          display: flex; align-items: center; gap: 8px; transition: transform 0.1s;
          user-select: none;
          /* Ensure button is always on top of menu visually if overlapped */
          position: relative; 
          z-index: 2;
        }
        .pill-btn:active { cursor: grabbing; transform: scale(0.98); }
        .pill-btn:hover { background: rgba(30, 30, 30, 0.95); }
        .dot { width: 6px; height: 6px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981; }
        
        .menu {
          position: absolute; /* Floating relative to the button */
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
        
        /* WATERMARK */
        .menu .watermark {
            position: absolute;
            bottom: -20px;
            right: -20px;
            width: 300px;
            height: 300px;
            z-index: 0;
            opacity: 0.03; /* Very faint */
            pointer-events: none;
            color: #10b981;
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

    const initShell = () => {
        if (document.getElementById('atlas-tools-host')) return; // Prevent duplicates
        const host = document.createElement('div');
        host.id = 'atlas-tools-host';
        host.style.position = 'fixed';
        // Initial position
        host.style.bottom = '20px';
        host.style.right = '20px';
        host.style.zIndex = '2147483647';
        document.body.appendChild(host);

        // Architecture Fix: App Shell Survival
        // Ensure host is not deleted by App hydration
        const observer = new MutationObserver((mutations) => {
            if (!document.body.contains(host)) {
               // Re-inject if removed
               document.body.appendChild(host);
            }
        });
        observer.observe(document.body, { childList: true, subtree: false });

        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = css;
        shadow.appendChild(style);

        const container = document.createElement('div');
        container.className = 'container';

        const menu = document.createElement('div');
        menu.className = 'menu';

        // Watermark Injection
        const watermark = document.createElement('div');
        watermark.className = 'watermark';
        // Use a larger version of the logo SVG
        watermark.innerHTML = ICONS.LOGO.replace('width="18"', 'width="100%"').replace('height="18"', 'height="100%"');
        menu.appendChild(watermark);

        // Tabs & Content
        const tabs = document.createElement('div');
        tabs.className = 'tabs';
        menu.appendChild(tabs);

        const content = document.createElement('div');
        content.className = 'content';
        menu.appendChild(content);

        // Render plugins
        __STATE__.tools.forEach((tool, index) => {
            // [ROADMAP] Only show non-redundant tools
            if (tool.name === 'Traffic' || tool.name === 'Logs') return;

            const btn = document.createElement('button');
            btn.className = 'tab';
            btn.innerText = tool.name === 'Network' ? 'Audit' : tool.name; // Rename Network to Audit
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

        // Pill Button
        const mainBtn = document.createElement('button');
        mainBtn.className = 'pill-btn';
        mainBtn.innerHTML = \`<span style="margin-right:6px; color:#10b981; display:flex;">\${ICONS.LOGO}</span> Atlas <span class="icon" style="margin-left:8px; color:#10b981; display:flex;">\${ICONS.CHECK}</span> <span class="count" style="margin-left:4px; font-family:monospace; opacity:0.8">0</span>\`;
        
        statusBtn = mainBtn; // Redirect status updates to main button

        // RECORDER STATE
        let recordingTimer = null;
        let accumulatedMs = 0;
        let segmentStartTime = null; // [FIXED] Removed TypeScript type ": number | null"

        window.Atlas.setRecordingState = (isActive) => {
            if (isActive) {
                // START RECORDING
                accumulatedMs = 0;
                segmentStartTime = Date.now();
                isPaused = false;
                
                mainBtn.classList.add('recording');
                menu.classList.remove('visible'); // Auto-Minimize
                updateTimer();
                recordingTimer = setInterval(updateTimer, 1000);
            } else {
                // STOP RECORDING
                mainBtn.classList.remove('recording');
                clearInterval(recordingTimer);
                recordingTimer = null;
                
                // Reset State
                accumulatedMs = 0;
                segmentStartTime = null;
                isPaused = false;

                // Reset UI
                mainBtn.innerHTML = \`<span style="margin-right:6px; color:#10b981; display:flex;">\${ICONS.LOGO}</span> Atlas <span class="icon" style="margin-left:8px; color:#10b981; display:flex;">\${ICONS.CHECK}</span> <span class="count" style="margin-left:4px; font-family:monospace; opacity:0.8">0</span>\`;
                updateStatusIndicator(); // Restore status
            }
        };

        let isPaused = false;

        function updateTimer() {
            if (!recordingTimer && !isPaused) return;
            
            // Calculate Duration
            let currentTotalMs = accumulatedMs;
            if (!isPaused && segmentStartTime) {
                currentTotalMs += (Date.now() - segmentStartTime);
            }

            const diff = Math.floor(currentTotalMs / 1000);
            const m = Math.floor(diff / 60).toString().padStart(2, '0');
            const s = Math.floor(diff % 60).toString().padStart(2, '0');
            
            // State-based UI
            const statusColor = isPaused ? '#f59e0b' : '#ef4444';
            const statusText = isPaused ? 'PAUSED' : 'REC';
            const pauseIcon = isPaused ? ICONS.PLAY : ICONS.PAUSE;
            
            // Template safely constructed
            let html = '<span style="color:' + statusColor + '; margin-right:6px;">●</span> ' + statusText + ' ' + m + ':' + s; // Keep dot as text or svg? Text circle is fine for REC dot, or use SVG. Let's keep ● for now as it flashes well.
            html += '<button id="pill-pause-btn" style="margin-left:8px; background:rgba(255,255,255,0.1); border:none; color:white; border-radius:4px; padding:2px 8px; cursor:pointer; font-size:12px; display:flex; align-items:center;">' + pauseIcon + '</button>';
            html += '<button id="pill-stop-btn" style="margin-left:4px; background:rgba(255,50,50,0.3); border:none; color:white; border-radius:4px; padding:2px 6px; cursor:pointer; font-size:10px; display:flex; align-items:center;">' + ICONS.STOP + '</button>';
            
            mainBtn.innerHTML = html;
            
            // Re-bind Buttons
            const stopBtn = mainBtn.querySelector('#pill-stop-btn');
            if (stopBtn) {
                stopBtn.onclick = (e) => {
                    e.stopPropagation();
                    // Instant Feedback
                    clearInterval(recordingTimer);
                    mainBtn.innerHTML = '<span style="color:#ef4444;">⏳ Stopping...</span>';
                    // Trigger backend
                    window.dispatchEvent(new CustomEvent('atlas-stop-recording'));
                };
            }

            const pauseBtn = mainBtn.querySelector('#pill-pause-btn');
            if (pauseBtn) {
                pauseBtn.onclick = (e) => {
                    e.stopPropagation();
                    isPaused = !isPaused;
                    
                    if (isPaused) {
                        // PAUSE: Accumulate elapsed time, freeze segment
                        if (segmentStartTime) {
                            accumulatedMs += (Date.now() - segmentStartTime);
                            segmentStartTime = null;
                        }
                    } else {
                        // RESUME: Start new segment
                        segmentStartTime = Date.now();
                    }

                    mainBtn.classList.toggle('paused', isPaused);
                    updateTimer(); // Refresh UI
                    window.dispatchEvent(new CustomEvent('atlas-toggle-pause', { detail: { paused: isPaused } }));
                };
            }
        }
        
        // Add CSS for pulse
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

        // --- Drag Logic ---
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        mainBtn.addEventListener('mousedown', (e) => {
            const rect = host.getBoundingClientRect();
            
            // Lock current position in fixed pixels
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
            updateQuadrant(); // Re-orient after drop
            saveState(); // Save new position
            setTimeout(() => { isDragging = false; }, 50);
        }

        // --- Smart Positioning (Absolute Logic) ---
        function updateQuadrant() {
            const rect = mainBtn.getBoundingClientRect();
            const winW = window.innerWidth;
            const winH = window.innerHeight;

            const isRightHalf = rect.left > winW / 2;
            const isBottomHalf = rect.top > winH / 2;
            const gap = '12px';

            // Reset all
            menu.style.top = '';
            menu.style.bottom = '';
            menu.style.left = '';
            menu.style.right = '';

            if (isBottomHalf) {
                 // Open UPWARDS
                 menu.style.bottom = \`calc(100% + \${gap})\`;
            } else {
                 // Open DOWNWARDS
                 menu.style.top = \`calc(100% + \${gap})\`;
            }

            if (isRightHalf) {
                // Align RIGHT edge
                menu.style.right = '0';
            } else {
                // Align LEFT edge
                menu.style.left = '0';
            }
        }

        function switchTab(name) {
            const allTabs = tabs.querySelectorAll('.tab');
            allTabs.forEach(t => {
                t.classList.toggle('active', t.innerText === name);
            });

            const allPanels = content.querySelectorAll('.panel');
            allPanels.forEach(p => {
                p.classList.toggle('active', p.id === \`panel-\${name}\`);
            });

            const tool = __STATE__.tools.find(t => t.name === name);
            if (tool && tool.onShow) tool.onShow();
            
            // Save State
            const visible = menu.classList.contains('visible');
            sessionStorage.setItem('atlas-ui-state', JSON.stringify({ visible, activeTab: name }));
        }
        
        // Initial setup
        const savedState = sessionStorage.getItem('atlas-ui-state');
        if (savedState) {
            try {
                const s = JSON.parse(savedState);
                if (s.visible) menu.classList.add('visible');
                // Restore Active Tab
                if (s.activeTab) switchTab(s.activeTab);
                
                // Restore Position
                if (s.x && s.y) {
                    host.style.bottom = 'auto';
                    host.style.right = 'auto';
                    host.style.left = s.x;
                    host.style.top = s.y;
                }
            } catch (e) { }
        } else {
             // Default open for first time? No, default closed is better.
        }
        
        // Save State Helper
        const saveState = () => {
             const visible = menu.classList.contains('visible');
             const activeTabBtn = tabs.querySelector('.tab.active');
             const activeTab = activeTabBtn ? activeTabBtn.innerText : null;
             
             // Save Position
             const rect = host.getBoundingClientRect();
             const x = rect.left + 'px';
             const y = rect.top + 'px';

             sessionStorage.setItem('atlas-ui-state', JSON.stringify({ visible, activeTab, x, y }));
        };

        // Click listener for Toggle
        mainBtn.addEventListener('click', (e) => {
            if (isDragging) return;
            const isVisible = menu.classList.contains('visible');
            if (isVisible) menu.classList.remove('visible');
            else {
                updateQuadrant(); // Look before leaping
                menu.classList.add('visible');
            }
            saveState(); // Save on toggle
        });
        
        updateQuadrant();

        // 6. GLOBAL HOTKEY LISTENER (Stealth Mode)
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.code === 'Space') {
                e.preventDefault();
                if (host.classList.contains('stealth')) {
                    host.classList.remove('stealth');
                    // Ensure it stays visible if user toggled it on
                } else {
                    host.classList.add('stealth');
                }
            }
        });
    };
    
    // 7. BOOTSTRAP
    try {
        console.log('[Atlas] 🚀 Bootstrapping UI Shell...');
        const bootstrap = () => {
            if (document.body) {
                initShell();
            } else {
                // Wait for body to be available
                requestAnimationFrame(bootstrap);
            }
        };

        if (document.readyState === 'loading') {
            console.log('[Atlas] Document loading, waiting for DOMContentLoaded...');
            window.addEventListener('DOMContentLoaded', bootstrap);
        } else {
            console.log('[Atlas] Document ready, running bootstrap...');
            bootstrap(); 
        }
    } catch (e) {
        console.error('[Atlas] Bootstrap Failed:', e);
    }

})();
`;