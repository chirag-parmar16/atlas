/**
 * Atlas UI — Shell Component
 * 
 * The core UI shell: pill, HUD, menu, tab system, drag logic,
 * violation tracking, recording UI, fullscreen enforcement.
 * 
 * This is the largest component (959 lines in original).
 * CSS is imported from styles/ — same visual output.
 */

import { SHELL_GLOBAL_CSS, SHELL_SHADOW_CSS, SHELL_HUD_CSS, SHELL_PILL_CSS } from '../styles/shell.css';

/** SVG icons used by the shell */
const ICONS = {
    CHECK: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    ALERT: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
    PAUSE: '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>',
    PLAY: '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>',
    STOP: '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"></rect></svg>',
    LOGO: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>',
    BOLT: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>'
};

/**
 * Build the shell injection script.
 * Imports CSS from extracted constants — same visual, structured source.
 */
export function buildShellScript(): string {
    // Escape for embedding in JS string
    const escapedGlobalCSS = JSON.stringify(SHELL_GLOBAL_CSS);
    const escapedShadowCSS = JSON.stringify(SHELL_SHADOW_CSS);
    const escapedHudCSS = JSON.stringify(SHELL_HUD_CSS);
    const escapedPillCSS = JSON.stringify(SHELL_PILL_CSS);
    const escapedIcons = JSON.stringify(ICONS);

    return `
(function () {
    // SPA / Redirect Handling Check
    if (window.Atlas) {
        if (!document.getElementById('atlas-tools-host')) {
             console.log('[Atlas] Detected SPA navigation/wipe. Re-injecting UI...');
        } else {
             return;
        }
    }

    var SEVERITY = { INFO: 0, WARN: 1, ERROR: 2 };

    var __STATE__ = {
        tools: [],
        violations: []
    };

    Object.defineProperty(window, '__ATLAS__', {
        value: __STATE__,
        writable: false,
        configurable: false
    });

    var ICONS = ${escapedIcons};

    var globalCss = ${escapedGlobalCSS};

    var AtlasAPI = {
        Severity: SEVERITY,
        addTool: function (name, renderCallback, onShow) {
            __STATE__.tools.push({ name: name, renderCallback: renderCallback, onShow: onShow });
        },
        reportViolation: function (source, message, level, metadata) {
            metadata = metadata || {};
            var v = { 
                source: source, 
                message: message, 
                level: level, 
                timestamp: Date.now(),
                url: (metadata && metadata.pageUrl) || window.location.href,
                metadata: metadata
            };
            __STATE__.violations.push(v);
            
            if (window.atlasLogViolation) {
                window.atlasLogViolation(v).catch(function() {});
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
            var source = 'Runtime';
            var msg = event.message;
            
            if (event.target && (event.target !== window)) {
                source = 'Resource';
                var el = event.target;
                var url = el.src || el.href || el.tagName;
                msg = 'Failed to load ' + el.tagName + ': ' + url;
            } else {
                 var filename = event.filename ? event.filename.split('/').pop() : 'inline';
                 if (msg) msg = 'Uncaught: ' + msg + ' @ ' + filename + ':' + event.lineno;
            }

            window.Atlas.reportViolation(source, msg, window.Atlas.Severity.ERROR);
        }
    }, true);

    window.addEventListener('unhandledrejection', function (event) {
        if (window.Atlas && window.Atlas.reportViolation) {
            var reason = event.reason ? (event.reason.stack || event.reason) : 'Unknown reason';
            var shortReason = String(reason).split('\\n')[0]; 
            window.Atlas.reportViolation('Promise', 'Unhandled: ' + shortReason, window.Atlas.Severity.WARN);
        }
    });

    var statusBtn = null;
    function updateStatusIndicator(shouldPulse) {
        if (!statusBtn) return;
        
        var seen = {};
        var uniqueViolations = __STATE__.violations.filter(function(v) {
            var key = v.source + '|' + v.message;
            if (seen[key]) return false;
            seen[key] = true;
            return true;
        });
        
        var counts = {};
        counts[SEVERITY.INFO] = 0;
        counts[SEVERITY.WARN] = 0;
        counts[SEVERITY.ERROR] = 0;
        uniqueViolations.forEach(function(v) { counts[v.level] = (counts[v.level] || 0) + 1; });
        var color = '#10b981'; 
        var icon = ICONS.CHECK;
        if (counts[SEVERITY.ERROR] > 0) { color = '#ef4444'; icon = ICONS.ALERT; } 
        else if (counts[SEVERITY.WARN] > 0) { color = '#f59e0b'; icon = ICONS.ALERT; }
        var iconEl = statusBtn.querySelector('.icon');
        var countEl = statusBtn.querySelector('.count');
        if (iconEl && countEl) {
             iconEl.style.color = color;
             iconEl.innerHTML = icon;
             countEl.innerText = counts[SEVERITY.ERROR] + counts[SEVERITY.WARN];
        }
        if (shouldPulse) {
            statusBtn.classList.add('pulse');
            setTimeout(function() { statusBtn.classList.remove('pulse'); }, 500);
        }
    }

    var css = ${escapedShadowCSS};

    // --- LOADING BAR CONTROLLER ---
    var Loader = {
        state: 0,
        timer: null,
        el: null,
        render: function(shadowRoot) {
             var div = document.createElement('div');
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
                var self = this;
                this.timer = setInterval(function() { self.inc(); }, 300);
            }
        },
        inc: function() {
             if (this.state >= 0.9) return;
             var amount = 0.05 * Math.random();
             this.update(this.state + amount);
        },
        update: function(n) {
             this.state = n;
             var bar = this.el.querySelector('.bar');
             if (bar) {
                 bar.style.transform = 'translate3d(-' + ((1 - n) * 100) + '%, 0, 0)';
                 bar.style.transition = 'all 200ms ease';
             }
        },
        done: function() {
            if (!this.el) return;
            this.update(1);
            if (this.timer) { clearInterval(this.timer); this.timer = null; }
            var self = this;
            setTimeout(function() {
                self.el.style.opacity = '0';
                setTimeout(function() {
                    self.el.style.display = 'none';
                    self.state = 0;
                    self.update(0);
                }, 200);
            }, 300);
        }
    };

    var initShell = function() {
        if (document.getElementById('atlas-tools-host')) return;
        var host = document.createElement('div');
        host.id = 'atlas-tools-host';
        host.style.position = 'fixed'; 
        host.style.bottom = '20px'; host.style.right = '20px'; host.style.zIndex = '2147483647';
        host.style.visibility = 'hidden'; // Start hidden to prevent flickering
        host.style.transition = 'none'; // Disable transition during init
        
        var mount = function() {
            var target = document.documentElement || document.body;
            if (target && !document.getElementById('atlas-tools-host')) {
                // Restore state BEFORE mounting to prevent flicker
                var saved = sessionStorage.getItem('atlas-ui-state');
                if (saved) {
                    try {
                        var s = JSON.parse(saved);
                        if (s.x && s.y) {
                            host.style.bottom = 'auto'; host.style.right = 'auto';
                            host.style.left = s.x; host.style.top = s.y;
                        }
                    } catch(e) {}
                }
                target.appendChild(host);
                console.log('[Atlas] UI Shell integrated into DOCUMENT_ROOT.');
            }
        };
        mount();

        // --- LAYOUT ENFORCER ---
        var enforceLayout = function() {
             if (!document.body) return;
             var nodes = Array.from(document.body.children).concat(
                 Array.from(document.querySelectorAll('header, nav, .fixed, [style*="fixed"]'))
             );
             nodes.forEach(function(el) {
                 if (el === host || el.id === 'atlas-tools-host') return;
                 if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
                 var style = window.getComputedStyle(el);
                 if (style.position === 'fixed' || style.position === 'sticky') {
                     var top = parseInt(style.top);
                     if (!isNaN(top) && top < 50) {
                         if (!el.dataset.atlasShifted) {
                             el.style.top = (top + 60) + 'px';
                             el.dataset.atlasShifted = 'true';
                         }
                     } else if (style.top === 'auto' && style.bottom === 'auto') {
                         el.style.top = '60px';
                         el.dataset.atlasShifted = 'true';
                     }
                 }
             });
        };

        var observer = new MutationObserver(function(mutations) {
            if (!document.getElementById('atlas-tools-host')) { 
                console.log('[Atlas] UI Shell disconnected. Re-integrating...');
                mount();
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });

        setInterval(function() {
            if (document.body && !document.body.contains(host)) { 
                try { mount(); } catch(e) {} 
            }
            if (document.body) {
                var isDevice = document.body.classList.contains('atlas-device-mode');
                var isHazard = document.body.classList.contains('atlas-hazard-mode');
                if (!isDevice && !isHazard) { document.body.classList.add('atlas-hazard-mode'); }
                enforceLayout();
            }
        }, 500);

        var shadow = host.attachShadow({ mode: 'open' });
        
        Loader.render(shadow);
        window.Atlas.startLoading = function() { Loader.start(); };
        window.Atlas.stopLoading = function() { Loader.done(); };

        var style = document.createElement('style');
        style.textContent = css;
        shadow.appendChild(style);

        var hudStyle = document.createElement('style');
        hudStyle.textContent = ${escapedHudCSS};
        shadow.appendChild(hudStyle);

        if (!document.getElementById('atlas-global-style')) {
            var gStyle = document.createElement('style');
            gStyle.id = 'atlas-global-style';
            gStyle.textContent = globalCss;
            (document.head || document.documentElement).appendChild(gStyle);
        }

        var config = window.__ATLAS_CONFIG__ || {};
        var fakeDomain = config.domain || '...';
        var realPort = config.port || '...';

        var hud = document.createElement('div');
        hud.className = 'hud-bar visible';
        hud.innerHTML = '<div class="hud-left">' +
            '<div class="hud-nav-btns">' +
                '<button class="hud-nav-btn" id="hud-back-btn" title="Go Back">‹</button>' +
                '<button class="hud-nav-btn" id="hud-fwd-btn" title="Go Forward">›</button>' +
            '</div>' +
            '<div class="hud-live"></div>' +
            '<span class="hud-label">ATLAS</span>' +
        '</div>' +
        '<div class="hud-url-bar">' +
            '<svg class="hud-url-lock" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' +
            '<input type="text" class="hud-url-input" id="hud-url-input" spellcheck="false" autocomplete="off" value="" />' +
        '</div>' +
        '<div class="hud-route-tag">' +
            '<span class="tag-domain">' + fakeDomain + '</span>' +
            '<span class="tag-arrow">→</span>' +
            '<span class="tag-port">:' + realPort + '</span>' +
        '</div>' +
        '<div class="hud-right">' +
            '<button class="hud-close-btn" id="hud-close-btn" title="Stop Atlas Session">✕</button>' +
        '</div>';
        shadow.appendChild(hud);

        var cleanPath = function(p) {
            return p.replace(/\\.(html?|php|aspx?|jsp)$/i, '');
        };

        var urlInput = shadow.querySelector('#hud-url-input');
        var isEditing = false;

        var updateUrlBar = function() {
            if (!urlInput || isEditing) return;
            try {
                var url = new URL(window.location.href);
                var protocol = url.protocol + '//';
                var domain = url.hostname;
                var rawPath = url.pathname + url.search + url.hash;
                var cleanedPath = cleanPath(rawPath);
                urlInput.value = protocol + domain + cleanedPath;
            } catch(e) {
                urlInput.value = window.location.href;
            }
        };
        updateUrlBar();
        window.addEventListener('load', updateUrlBar);
        setTimeout(updateUrlBar, 500);
        setTimeout(updateUrlBar, 1500);

        if (urlInput) {
            urlInput.addEventListener('focus', function() { isEditing = true; });
            urlInput.addEventListener('blur', function() { isEditing = false; updateUrlBar(); });

            urlInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    var val = urlInput.value.trim();
                    if (!val) return;

                    var targetUrl = val;
                    if (!val.startsWith('http://') && !val.startsWith('https://')) {
                        if (val.startsWith(fakeDomain)) {
                            targetUrl = window.location.protocol + '//' + val;
                        } else if (val.startsWith('/')) {
                            targetUrl = window.location.origin + val;
                        } else {
                            targetUrl = window.location.origin + '/' + val;
                        }
                    }
                    window.location.href = targetUrl;
                    urlInput.blur();
                }
            });
        }

        window.addEventListener('hashchange', updateUrlBar);
        window.addEventListener('popstate', updateUrlBar);
        var origPush = history.pushState;
        history.pushState = function() {
            origPush.apply(this, arguments);
            setTimeout(updateUrlBar, 50);
        };
        var origReplace = history.replaceState;
        history.replaceState = function() {
            origReplace.apply(this, arguments);
            setTimeout(updateUrlBar, 50);
        };

        // --- Button Handlers ---
        var closeBtn = shadow.querySelector('#hud-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                if (window.atlasCloseBrowser) window.atlasCloseBrowser();
                else window.close();
            });
        }
        var backBtn = shadow.querySelector('#hud-back-btn');
        var fwdBtn = shadow.querySelector('#hud-fwd-btn');
        if (backBtn) backBtn.addEventListener('click', function() {
            if (window.atlasGoBack) window.atlasGoBack();
            else history.back();
            setTimeout(updateUrlBar, 300);
            setTimeout(updateUrlBar, 1000);
        });
        if (fwdBtn) fwdBtn.addEventListener('click', function() {
            if (window.atlasGoForward) window.atlasGoForward();
            else history.forward();
            setTimeout(updateUrlBar, 300);
            setTimeout(updateUrlBar, 1000);
        });

        window.Atlas.updateHUD = function(fd, rp) {
            var tagDomain = shadow.querySelector('.tag-domain');
            var tagPort = shadow.querySelector('.tag-port');
            if (tagDomain) tagDomain.textContent = fd;
            if (tagPort) tagPort.textContent = ':' + rp;
        };

        // --- Fullscreen Enforcement ---
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' || e.key === 'F11') {
                e.preventDefault();
                e.stopPropagation();
                var toast = shadow.querySelector('.atlas-fs-toast');
                if (!toast) {
                    toast = document.createElement('div');
                    toast.className = 'atlas-fs-toast';
                    toast.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);background:#1c1917;color:#fbbf24;padding:8px 20px;border-radius:8px;font-size:12px;font-family:Inter,sans-serif;border:1px solid #422006;z-index:2147483647;opacity:0;transition:opacity 0.3s;pointer-events:none;';
                    shadow.appendChild(toast);
                }
                toast.textContent = '⚠ Sandbox mode — fullscreen is locked. Use ✕ to stop session.';
                toast.style.opacity = '1';
                setTimeout(function() { toast.style.opacity = '0'; }, 2500);
                return false;
            }
        }, true);

        window.Atlas.toggleDeviceMode = function(enabled) {
            if (enabled) {
                document.documentElement.classList.add('atlas-device-wrapper');
                document.body.classList.add('atlas-device-mode');
            } else {
                document.documentElement.classList.remove('atlas-device-wrapper');
                document.body.classList.remove('atlas-device-mode');
            }
        };

        document.body.classList.add('atlas-hazard-mode');

        var container = document.createElement('div');
        container.className = 'container';
        var menu = document.createElement('div');
        menu.className = 'menu';

        var watermark = document.createElement('div');
        watermark.className = 'watermark';
        watermark.innerHTML = ICONS.LOGO.replace('width="18"', 'width="100%"').replace('height="18"', 'height="100%"');
        menu.appendChild(watermark);

        var tabs = document.createElement('div');
        tabs.className = 'tabs';
        menu.appendChild(tabs);

        var content = document.createElement('div');
        content.className = 'content';
        menu.appendChild(content);

        __STATE__.tools.forEach(function(tool, index) {
            var btn = document.createElement('button');
            btn.className = 'tab';
            btn.innerText = tool.name;
            btn.onclick = function() { switchTab(tool.name); };
            tabs.appendChild(btn);

            var panel = document.createElement('div');
            panel.className = 'panel';
            panel.id = 'panel-' + tool.name;
            if (tool.renderCallback) {
                var el = tool.renderCallback();
                if (el) panel.appendChild(el);
            }
            content.appendChild(panel);

            if (tabs.children.length === 1) {
                btn.classList.add('active');
                panel.classList.add('active');
            }
        });

        var mainBtn = document.createElement('button');
        mainBtn.className = 'pill-btn';
        mainBtn.innerHTML = '<span style="margin-right:6px; color:#10b981; display:flex;">' + ICONS.LOGO + '</span> Atlas <span class="icon" style="margin-left:8px; color:#10b981; display:flex;">' + ICONS.CHECK + '</span> <span class="count" style="margin-left:4px; font-family:monospace; opacity:0.8">0</span>';
        statusBtn = mainBtn;

        var recordingTimer = null;
        var accumulatedMs = 0;
        var segmentStartTime = null; 
        var isPaused = false;

        window.Atlas.setRecordingState = function(isActive) {
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
                mainBtn.innerHTML = '<span style="margin-right:6px; color:#10b981; display:flex;">' + ICONS.LOGO + '</span> Atlas <span class="icon" style="margin-left:8px; color:#10b981; display:flex;">' + ICONS.CHECK + '</span> <span class="count" style="margin-left:4px; font-family:monospace; opacity:0.8">0</span>';
                updateStatusIndicator(); 
            }
        };

        function updateTimer() {
            if (!recordingTimer && !isPaused) return;
            var currentTotalMs = accumulatedMs;
            if (!isPaused && segmentStartTime) {
                currentTotalMs += (Date.now() - segmentStartTime);
            }
            var diff = Math.floor(currentTotalMs / 1000);
            var m = Math.floor(diff / 60).toString().padStart(2, '0');
            var s = Math.floor(diff % 60).toString().padStart(2, '0');
            var statusColor = isPaused ? '#f59e0b' : '#ef4444';
            var statusText = isPaused ? 'PAUSED' : 'REC';
            var pauseIcon = isPaused ? ICONS.PLAY : ICONS.PAUSE;
            
            var html = '<span style="color:' + statusColor + '; margin-right:6px;">●</span> ' + statusText + ' ' + m + ':' + s; 
            html += '<button id="pill-pause-btn" style="margin-left:8px; background:rgba(255,255,255,0.1); border:none; color:white; border-radius:4px; padding:2px 8px; cursor:pointer; font-size:12px; display:flex; align-items:center;">' + pauseIcon + '</button>';
            html += '<button id="pill-stop-btn" style="margin-left:4px; background:rgba(255,50,50,0.3); border:none; color:white; border-radius:4px; padding:2px 6px; cursor:pointer; font-size:10px; display:flex; align-items:center;">' + ICONS.STOP + '</button>';
            mainBtn.innerHTML = html;
            
            var stopBtn = mainBtn.querySelector('#pill-stop-btn');
            if (stopBtn) {
                stopBtn.onclick = function(e) {
                    e.stopPropagation();
                    clearInterval(recordingTimer);
                    mainBtn.innerHTML = '<span style="color:#ef4444;">⏳ Stopping...</span>';
                    window.dispatchEvent(new CustomEvent('atlas-stop-recording'));
                };
            }
            var pauseBtn = mainBtn.querySelector('#pill-pause-btn');
            if (pauseBtn) {
                pauseBtn.onclick = function(e) {
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

        var pulseStyle = document.createElement('style');
        pulseStyle.textContent = ${escapedPillCSS};
        shadow.appendChild(pulseStyle);

        container.appendChild(menu);
        container.appendChild(mainBtn);
        shadow.appendChild(container);

        var isDragging = false;
        var startX, startY, initialLeft, initialTop;
        mainBtn.addEventListener('mousedown', function(e) {
            var rect = host.getBoundingClientRect();
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
            var dx = e.clientX - startX;
            var dy = e.clientY - startY;
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
            setTimeout(function() { isDragging = false; }, 50);
        }

        function updateQuadrant() {
            var rect = mainBtn.getBoundingClientRect();
            var winW = window.innerWidth;
            var winH = window.innerHeight;
            var isRightHalf = rect.left > winW / 2;
            var isBottomHalf = rect.top > winH / 2;
            var gap = '12px';
            menu.style.top = '';
            menu.style.bottom = '';
            menu.style.left = '';
            menu.style.right = '';
            if (isBottomHalf) { menu.style.bottom = 'calc(100% + ' + gap + ')'; } else { menu.style.top = 'calc(100% + ' + gap + ')'; }
            if (isRightHalf) { menu.style.right = '0'; } else { menu.style.left = '0'; }
        }

        function switchTab(name) {
            var allTabs = tabs.querySelectorAll('.tab');
            allTabs.forEach(function(t) { t.classList.toggle('active', t.innerText === name); });
            var allPanels = content.querySelectorAll('.panel');
            allPanels.forEach(function(p) { p.classList.toggle('active', p.id === 'panel-' + name); });
            var tool = __STATE__.tools.find(function(t) { return t.name === name; });
            if (tool && tool.onShow) tool.onShow();
            var visible = menu.classList.contains('visible');
            sessionStorage.setItem('atlas-ui-state', JSON.stringify({ visible: visible, activeTab: name }));
        }

        var savedState = sessionStorage.getItem('atlas-ui-state');
        if (savedState) {
            try {
                var s = JSON.parse(savedState);
                if (s.visible) menu.classList.add('visible');
                if (s.activeTab) switchTab(s.activeTab);
            } catch (e) { }
        }

        // Reveal logic
        var isFirstBoot = !sessionStorage.getItem('__atlas_booted__');
        if (isFirstBoot) {
            setTimeout(function() {
                host.style.visibility = 'visible';
                setTimeout(function() { host.style.transition = ''; }, 100);
            }, 3500);
        } else {
            host.style.visibility = 'visible';
            host.style.transition = '';
        }

        var saveState = function() {
             var visible = menu.classList.contains('visible');
             var activeTabBtn = tabs.querySelector('.tab.active');
             var activeTab = activeTabBtn ? activeTabBtn.innerText : null;
             var rect = host.getBoundingClientRect();
             var x = rect.left + 'px';
             var y = rect.top + 'px';
             sessionStorage.setItem('atlas-ui-state', JSON.stringify({ visible: visible, activeTab: activeTab, x: x, y: y }));
        };

        mainBtn.addEventListener('click', function(e) {
            if (isDragging) return;
            var isVisible = menu.classList.contains('visible');
            if (isVisible) menu.classList.remove('visible');
            else { updateQuadrant(); menu.classList.add('visible'); }
            saveState(); 
        });
        
        updateQuadrant();

        window.addEventListener('keydown', function(e) {
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
    var __lastSyncedUrl__ = window.location.href;
    var syncViolationsFromBackend = async function() {
        try {
            var currentUrl = window.location.href;
            if (currentUrl !== __lastSyncedUrl__) {
                __STATE__.violations.length = 0;
                __lastSyncedUrl__ = currentUrl;
            }

            var prevCount = __STATE__.violations.length;

            if (window.__ATLAS_VIOLATION_QUEUE__ && window.__ATLAS_VIOLATION_QUEUE__.length > 0) {
                window.__ATLAS_VIOLATION_QUEUE__.forEach(function(v) {
                    var exists = __STATE__.violations.some(function(ex) { 
                        return ex.source === v.source && ex.message === v.message && ex.timestamp === v.timestamp;
                    });
                    if (!exists) {
                        __STATE__.violations.push(v);
                    }
                });
                window.__ATLAS_VIOLATION_QUEUE__ = [];
            }

            if (window.getFullViolationHistory) {
                var history = await window.getFullViolationHistory();
                if (history && history.length > 0) {
                    history.forEach(function(v) {
                        var exists = __STATE__.violations.some(function(ex) {
                            return ex.source === v.source && ex.message === v.message && ex.timestamp === v.timestamp;
                        });
                        if (!exists) {
                            __STATE__.violations.push(v);
                        }
                    });
                }
            }

            if (window.__ATLAS_NETWORK_QUEUE__ && window.__ATLAS_NETWORK_QUEUE__.length > 0) {
                window.__ATLAS_NETWORK_QUEUE__.forEach(function(d) {
                    if (window.Atlas && window.Atlas.logNetworkRequest) window.Atlas.logNetworkRequest(d);
                });
                window.__ATLAS_NETWORK_QUEUE__ = [];
            }

            if (__STATE__.violations.length !== prevCount) {
                updateStatusIndicator(true);
                window.dispatchEvent(new CustomEvent('atlas-violation'));
            }
        } catch(e) { }
    };

    try {
        console.log('[Atlas] 🚀 Bootstrapping UI Shell...');
        var bootstrap = function() {
            if (document.body) {
                initShell();
                setTimeout(syncViolationsFromBackend, 500);
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
}

/** Backward-compatible export */
export const UI_SHELL = buildShellScript();
