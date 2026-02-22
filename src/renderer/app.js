/**
 * Atlas Renderer — Main Application
 * 
 * Runs INSIDE the user's page (Shadow DOM).
 * Connects to Engine via WebSocket for data.
 * Pure browser JavaScript — no build step.
 * 
 * Globals provided by injector:
 *   window.__atlas_shadow__    — Shadow DOM root
 *   window.__atlas_app_root__  — App container div
 *   window.__atlas_ws_port__   — WebSocket port
 */

(function () {
    var shadowRoot = window.__atlas_shadow__;
    var appRoot = window.__atlas_app_root__;
    var wsPort = window.__atlas_ws_port__;

    if (!shadowRoot || !appRoot) {
        console.error('[Atlas Renderer] Missing shadow root or app root');
        return;
    }

    // --- State ---
    var state = {
        consoleLogs: [],
        networkRequests: [],
        violations: [],
        recorderState: { isRecording: false, isPaused: false },
        activeTab: 'Console',
        menuOpen: false,
        currentUrl: ''
    };

    var ws = null;
    var tabs = [];
    var TAB_NAMES = ['Console', 'Networks', 'Application', 'Storage', 'Scalability', 'Security', 'Extras'];

    // --- Helper: query inside shadow DOM ---
    function $(selector) { return shadowRoot.querySelector(selector); }
    function $$(selector) { return shadowRoot.querySelectorAll(selector); }

    // --- WebSocket Connection ---
    function connectWS() {
        if (!wsPort) { console.error('[Atlas Renderer] No ws port'); return; }
        ws = new WebSocket('ws://localhost:' + wsPort);
        ws.onopen = function () { console.log('[Atlas Renderer] Connected to Engine'); };
        ws.onmessage = function (event) { try { handleMessage(JSON.parse(event.data)); } catch (e) { } };
        ws.onclose = function () { setTimeout(connectWS, 2000); };
        ws.onerror = function () { };
    }

    function sendAction(type, payload) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            var msg = { type: type };
            if (payload) { for (var k in payload) msg[k] = payload[k]; }
            ws.send(JSON.stringify(msg));
        }
    }

    // --- Message Handler ---
    function handleMessage(msg) {
        switch (msg.type) {
            case 'STATE_SYNC':
                if (msg.payload) {
                    state.consoleLogs = msg.payload.consoleLogs || [];
                    state.networkRequests = msg.payload.networkRequests || [];
                    state.violations = msg.payload.violations || [];
                    state.recorderState = msg.payload.recorder || state.recorderState;
                    state.currentUrl = msg.payload.navigations && msg.payload.navigations.length > 0
                        ? msg.payload.navigations[msg.payload.navigations.length - 1].url : '';
                }
                renderActiveTab(); updatePill(); updateHUD();
                break;
            case 'CONSOLE_LOG':
                state.consoleLogs.push(msg.payload);
                if (state.consoleLogs.length > 500) state.consoleLogs.shift();
                if (state.activeTab === 'Console') renderActiveTab();
                updatePill();
                break;
            case 'NETWORK_EVENT':
                state.networkRequests.push(msg.payload);
                if (state.networkRequests.length > 500) state.networkRequests.shift();
                if (state.activeTab === 'Networks') renderActiveTab();
                break;
            case 'VIOLATION':
                state.violations.push(msg.payload);
                if (state.activeTab === 'Security' || state.activeTab === 'Scalability') renderActiveTab();
                updatePill();
                break;
            case 'NAVIGATION':
                state.currentUrl = msg.payload.url || '';
                updateHUD();
                break;
            case 'RECORDER_STATUS':
                state.recorderState = msg.payload;
                updatePill();
                if (state.activeTab === 'Extras') renderActiveTab();
                break;
            case 'PAGE_INFO':
                state.pageInfo = msg.payload;
                if (state.activeTab === 'Application') renderActiveTab();
                break;
            case 'STORAGE_METRICS':
                state.storageMetrics = msg.payload;
                if (state.activeTab === 'Storage') renderActiveTab();
                break;
        }
    }

    // --- Pill ---
    function updatePill() {
        var pill = $('#atlas-pill');
        if (!pill) return;
        pill.className = 'atlas-pill';
        if (state.recorderState.isRecording) pill.classList.add('recording');
        else {
            var errors = state.violations.filter(function (v) { return v.level === 2; }).length;
            var warns = state.violations.filter(function (v) { return v.level === 1; }).length;
            if (errors > 0) pill.classList.add('error');
            else if (warns > 0) pill.classList.add('warn');
        }
    }

    // --- HUD ---
    function updateHUD() {
        var urlBar = $('#hud-url');
        if (urlBar && state.currentUrl) urlBar.textContent = state.currentUrl;
    }

    // --- Tab Rendering ---
    function renderActiveTab() {
        var container = $('#tab-content');
        if (!container) return;
        for (var i = 0; i < tabs.length; i++) {
            if (tabs[i].name === state.activeTab) { tabs[i].render(container, state); break; }
        }
    }

    function switchTab(name) {
        state.activeTab = name;
        $$('.atlas-tab').forEach(function (el) { el.classList.toggle('active', el.getAttribute('data-tab') === name); });
        if (name === 'Application') sendAction('REQUEST_PAGE_INFO');
        if (name === 'Storage') sendAction('REQUEST_STORAGE');
        renderActiveTab();
    }

    function registerTab(component) { tabs.push(component); }

    function escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // --- Build UI ---
    function buildUI() {
        // HUD (fixed at top, pointer-events: auto)
        var hud = document.createElement('div');
        hud.className = 'atlas-hud';
        hud.innerHTML = '<button class="hud-btn" id="hud-back" title="Back">◀</button>' +
            '<button class="hud-btn" id="hud-forward" title="Forward">▶</button>' +
            '<div class="hud-url" id="hud-url">Loading...</div>' +
            '<button class="hud-btn" id="hud-minimize" title="Minimize">_</button>' +
            '<button class="hud-btn" id="hud-toggle" title="Toggle Window">☐</button>' +
            '<button class="hud-close" id="hud-close" title="Close Atlas">✕</button>';
        appRoot.appendChild(hud);

        // Bind HUD buttons
        $('#hud-back').onclick = function () { sendAction('GO_BACK'); };
        $('#hud-forward').onclick = function () { sendAction('GO_FORWARD'); };
        $('#hud-minimize').onclick = function () { sendAction('MINIMIZE'); };
        $('#hud-toggle').onclick = function () { sendAction('TOGGLE_WINDOW'); };
        $('#hud-close').onclick = function () { sendAction('CLOSE_BROWSER'); };

        // Menu Panel
        var menu = document.createElement('div');
        menu.className = 'atlas-menu';
        menu.id = 'atlas-menu';

        var tabBar = document.createElement('div');
        tabBar.className = 'atlas-tabs';
        TAB_NAMES.forEach(function (name) {
            var btn = document.createElement('button');
            btn.className = 'atlas-tab' + (name === state.activeTab ? ' active' : '');
            btn.textContent = name;
            btn.setAttribute('data-tab', name);
            btn.onclick = function () { switchTab(name); };
            tabBar.appendChild(btn);
        });
        menu.appendChild(tabBar);

        var content = document.createElement('div');
        content.className = 'atlas-tab-content';
        content.id = 'tab-content';
        menu.appendChild(content);
        appRoot.appendChild(menu);

        // Pill (draggable)
        var pill = document.createElement('div');
        pill.className = 'atlas-pill';
        pill.id = 'atlas-pill';
        pill.innerHTML = '<span class="atlas-pill-icon">⚡</span>';

        var isDragging = false, dragStartX = 0, dragStartY = 0, pillStartX = 0, pillStartY = 0;

        pill.addEventListener('mousedown', function (e) {
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            var rect = pill.getBoundingClientRect();
            pillStartX = rect.left;
            pillStartY = rect.top;
            e.preventDefault();
        });

        document.addEventListener('mousemove', function (e) {
            if (!isDragging) return;
            pill.style.left = (pillStartX + e.clientX - dragStartX) + 'px';
            pill.style.top = (pillStartY + e.clientY - dragStartY) + 'px';
            pill.style.right = 'auto';
            pill.style.bottom = 'auto';
        });

        document.addEventListener('mouseup', function (e) {
            if (!isDragging) return;
            isDragging = false;
            if (Math.abs(e.clientX - dragStartX) < 5 && Math.abs(e.clientY - dragStartY) < 5) {
                state.menuOpen = !state.menuOpen;
                menu.classList.toggle('open', state.menuOpen);
                if (state.menuOpen) renderActiveTab();
            }
        });

        appRoot.appendChild(pill);
    }

    // ====== TAB COMPONENTS ======

    // Console
    registerTab({
        name: 'Console',
        render: function (container) {
            container.innerHTML = '';
            if (state.consoleLogs.length === 0) { container.innerHTML = '<div class="empty-state">No console logs captured yet.</div>'; return; }
            var filterBar = document.createElement('div');
            filterBar.style.cssText = 'display:flex; gap:4px; margin-bottom:8px; flex-wrap:wrap;';
            var list = document.createElement('div');
            ['all', 'error', 'warn', 'log', 'info', 'debug'].forEach(function (level) {
                var count = level === 'all' ? state.consoleLogs.length : state.consoleLogs.filter(function (l) { return l.level === level; }).length;
                var btn = document.createElement('button');
                btn.className = 'action-btn'; btn.style.fontSize = '10px';
                btn.textContent = level + ' (' + count + ')';
                btn.onclick = function () { renderLogs(list, level === 'all' ? state.consoleLogs : state.consoleLogs.filter(function (l) { return l.level === level; })); };
                filterBar.appendChild(btn);
            });
            container.appendChild(filterBar);
            renderLogs(list, state.consoleLogs);
            container.appendChild(list);
        }
    });

    function renderLogs(container, logs) {
        container.innerHTML = '';
        logs.slice(-200).forEach(function (log) {
            var entry = document.createElement('div');
            entry.className = 'console-entry ' + log.level;
            entry.innerHTML = '<span class="timestamp">' + new Date(log.timestamp).toLocaleTimeString() + '</span><span class="message">' + escapeHtml(log.message) + '</span>';
            if (log.stack) {
                var stackEl = document.createElement('pre');
                stackEl.style.cssText = 'display:none; color:#666; font-size:10px; margin-top:4px; padding:4px; background:#111; border-radius:3px; white-space:pre-wrap;';
                stackEl.textContent = log.stack;
                entry.onclick = function () { stackEl.style.display = stackEl.style.display === 'none' ? 'block' : 'none'; };
                entry.style.cursor = 'pointer';
                entry.appendChild(stackEl);
            }
            container.appendChild(entry);
        });
        container.scrollTop = container.scrollHeight;
    }

    // Networks
    registerTab({
        name: 'Networks',
        render: function (container) {
            container.innerHTML = '';
            if (state.networkRequests.length === 0) { container.innerHTML = '<div class="empty-state">No network requests captured yet.</div>'; return; }
            var SC = { '2': '#10b981', '3': '#3b82f6', '4': '#f59e0b', '5': '#ef4444' };
            var list = document.createElement('div'); list.style.fontSize = '11px';
            state.networkRequests.slice().reverse().slice(0, 200).forEach(function (req) {
                var sc = SC[String(req.status).charAt(0)] || '#9aa0a6';
                var fileName = req.url; try { fileName = new URL(req.url).pathname.split('/').pop() || '/'; } catch (e) { }
                var row = document.createElement('div'); row.className = 'net-row';
                row.innerHTML = '<div class="net-cell" title="' + escapeHtml(req.url) + '">' + escapeHtml(fileName) + '</div><div class="net-cell" style="color:' + sc + '">' + (req.status || '...') + '</div><div class="net-cell">' + (req.type || '-') + '</div><div class="net-cell">' + (req.body ? Math.round(req.body.length / 1024) + 'K' : '-') + '</div><div class="net-cell">' + (req.time ? Math.round(req.time) + 'ms' : '...') + '</div><div class="net-cell">' + req.method + '</div>';
                var detail = document.createElement('div');
                detail.style.cssText = 'display:none; padding:10px; background:#111; border:1px solid #333; margin:4px 0; border-radius:4px; max-height:300px; overflow:auto; font-size:11px;';
                var rendered = false;
                row.onclick = function () {
                    if (!rendered) { detail.innerHTML = '<div><b>URL:</b> ' + escapeHtml(req.url) + '</div><div><b>Method:</b> ' + req.method + ' | <b>Status:</b> ' + req.status + ' | <b>Time:</b> ' + req.time + 'ms</div>' + (req.body ? '<pre style="white-space:pre-wrap; margin-top:8px; color:#a8c7fa; max-height:200px; overflow:auto;">' + escapeHtml(req.body.substring(0, 5000)) + '</pre>' : ''); rendered = true; }
                    detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
                };
                list.appendChild(row); list.appendChild(detail);
            });
            container.appendChild(list);
        }
    });

    // Application
    registerTab({
        name: 'Application', render: function (container) {
            if (!state.pageInfo) { container.innerHTML = '<div class="empty-state">Loading page info...</div>'; return; }
            var p = state.pageInfo;
            var html = '<div style="margin-bottom:8px;"><b>Title:</b> ' + escapeHtml(p.title) + '</div><div style="margin-bottom:8px;"><b>URL:</b> ' + escapeHtml(p.url) + '</div><div style="margin-bottom:8px;"><b>Charset:</b> ' + p.charset + ' | <b>Ready:</b> ' + p.readyState + '</div>';
            if (p.metaTags && p.metaTags.length) { html += '<div style="font-weight:bold; margin:8px 0 4px;">Meta Tags (' + p.metaTags.length + ')</div>'; p.metaTags.forEach(function (m) { html += '<div style="color:#9aa0a6; font-size:10px;">' + escapeHtml(m.name) + ': ' + escapeHtml(m.content) + '</div>'; }); }
            if (p.scripts) html += '<div style="margin:8px 0;"><b>Scripts:</b> ' + p.scripts.external + ' external, ' + p.scripts.inline + ' inline</div>';
            if (p.cookies && p.cookies.length) { html += '<div style="font-weight:bold; margin:8px 0 4px;">Cookies (' + p.cookies.length + ')</div>'; p.cookies.forEach(function (c) { html += '<div style="font-size:10px;"><span style="color:#f28b82">' + escapeHtml(c.name) + '</span>: ' + escapeHtml(c.value) + '</div>'; }); }
            container.innerHTML = html;
        }
    });

    // Storage
    registerTab({
        name: 'Storage', render: function (container) {
            if (!state.storageMetrics) { container.innerHTML = '<div class="empty-state">Loading storage metrics...</div>'; return; }
            var m = state.storageMetrics;
            var fmt = function (b) { return b > 1024 * 1024 ? (b / 1024 / 1024).toFixed(1) + 'MB' : b > 1024 ? (b / 1024).toFixed(1) + 'KB' : b + 'B'; };
            var html = '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">';
            html += '<div style="background:#111; padding:8px; border-radius:4px;"><div style="color:#666; font-size:10px;">Page Weight</div><div style="font-size:16px; color:#10b981;">' + fmt(m.totalTransfer) + '</div></div>';
            html += '<div style="background:#111; padding:8px; border-radius:4px;"><div style="color:#666; font-size:10px;">DOM Size</div><div style="font-size:16px; color:#3b82f6;">' + fmt(m.domSize) + '</div></div>';
            html += '<div style="background:#111; padding:8px; border-radius:4px;"><div style="color:#666; font-size:10px;">LocalStorage</div><div style="font-size:16px; color:#f59e0b;">' + fmt(m.localStorageSize) + '</div></div>';
            html += '<div style="background:#111; padding:8px; border-radius:4px;"><div style="color:#666; font-size:10px;">Cookies</div><div style="font-size:16px; color:#ef4444;">' + fmt(m.cookieSize) + '</div></div></div>';
            if (m.resources && m.resources.length) { html += '<div style="font-weight:bold; margin:8px 0 4px;">Top Resources</div>'; m.resources.slice(0, 10).forEach(function (r) { var n = r.name; try { n = new URL(r.name).pathname.split('/').pop() || r.name; } catch (e) { } html += '<div style="display:flex; justify-content:space-between; padding:2px 0; border-bottom:1px solid #1a1a1a;"><span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:300px;">' + escapeHtml(n) + '</span><span style="color:#10b981;">' + fmt(r.size) + '</span></div>'; }); }
            container.innerHTML = html;
        }
    });

    // Scalability
    registerTab({
        name: 'Scalability', render: function (container) {
            container.innerHTML = '';
            var section = document.createElement('div');
            section.innerHTML = '<div style="font-weight:bold; margin-bottom:8px;">Stressors</div>';
            function mkSlider(label, key, val) {
                var w = document.createElement('div'); w.style.marginBottom = '12px';
                w.innerHTML = '<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>' + label + '</span><span id="val-' + key + '">' + val + '%</span></div>';
                var s = document.createElement('input'); s.type = 'range'; s.min = '0'; s.max = '50'; s.value = String(val); s.className = 'stress-slider'; s.id = 'slider-' + key;
                s.oninput = function () { $('#val-' + key).textContent = s.value + '%'; };
                s.onchange = function () { var eEl = $('#slider-error'), lEl = $('#slider-latency'); sendAction('SET_STRESS_CONFIG', { config: { enabled: true, errorRate: eEl ? parseInt(eEl.value) : 0, latencyRate: lEl ? parseInt(lEl.value) : 0, dropRate: 0 } }); };
                w.appendChild(s); return w;
            }
            section.appendChild(mkSlider('Error Rate (500s)', 'error', 0));
            section.appendChild(mkSlider('Latency Spike (2-5s)', 'latency', 0));
            container.appendChild(section);
            var monitor = document.createElement('div'); monitor.innerHTML = '<div style="font-weight:bold; margin:16px 0 8px;">Live Monitor</div>';
            var nv = state.violations.filter(function (v) { return v.source !== 'Security Warden'; });
            if (!nv.length) monitor.innerHTML += '<div class="empty-state">No stability violations detected.</div>';
            else nv.slice().reverse().slice(0, 50).forEach(function (v) { var el = document.createElement('div'); el.className = 'violation-entry' + (v.level === 2 ? ' critical' : ''); el.innerHTML = '<div style="display:flex; justify-content:space-between;"><b>' + escapeHtml(v.source) + '</b><span style="color:#666; font-size:10px;">' + new Date(v.timestamp).toLocaleTimeString() + '</span></div><div style="margin-top:4px;">' + escapeHtml(v.message) + '</div>'; monitor.appendChild(el); });
            container.appendChild(monitor);
        }
    });

    // Security
    registerTab({
        name: 'Security', render: function (container) {
            container.innerHTML = '';
            var ctrl = document.createElement('div'); ctrl.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding:8px; background:rgba(255,255,255,0.03); border-radius:6px;';
            ctrl.innerHTML = '<span>Warden Mode:</span>';
            var sel = document.createElement('select'); sel.style.cssText = 'background:#000; color:#fff; border:1px solid #333; padding:4px; font-size:11px;';
            sel.innerHTML = '<option value="Standard">Standard (Log Only)</option><option value="Strict">Strict (Block Insecure)</option>';
            sel.onchange = function () { sendAction('SET_SECURITY_MODE', { mode: sel.value }); }; ctrl.appendChild(sel); container.appendChild(ctrl);
            var sv = state.violations.filter(function (v) { return v.source === 'Security Warden'; });
            if (!sv.length) container.innerHTML += '<div class="empty-state">No security violations detected.</div>';
            else sv.slice().reverse().slice(0, 50).forEach(function (v) { var el = document.createElement('div'); el.className = 'violation-entry critical'; el.innerHTML = '<div style="display:flex; justify-content:space-between;"><b>🛡️ ' + escapeHtml(v.source) + '</b><span style="color:#666; font-size:10px;">' + new Date(v.timestamp).toLocaleTimeString() + '</span></div><div style="margin-top:4px;">' + escapeHtml(v.message) + '</div>'; container.appendChild(el); });
        }
    });

    // Extras
    registerTab({
        name: 'Extras', render: function (container) {
            container.innerHTML = '';
            var info = document.createElement('div'); info.style.cssText = 'text-align:center; padding:15px; background:rgba(255,255,255,0.03); border-radius:8px; margin-bottom:15px; color:#71717a;';
            info.innerHTML = '<div style="font-size:24px; margin-bottom:10px;">📊</div><b>Automated Reporting Active</b><br>Journeys and violations recorded in real-time.<br><span style="color:#10b981">atlas-audit-report.md</span> generated on exit.';
            container.appendChild(info);
            var rs = document.createElement('div'); rs.innerHTML = '<div style="font-weight:bold; border-bottom:1px solid #333; padding-bottom:4px; margin-bottom:8px;">Session Recording</div>';
            var rb = document.createElement('button'); rb.className = 'action-btn'; rb.style.width = '100%';
            rb.innerHTML = state.recorderState.isRecording ? '<span style="color:#ef4444">⏹ Stop Recording</span>' : '🔴 Start New Recording';
            rb.onclick = function () { sendAction(state.recorderState.isRecording ? 'STOP_RECORDING' : 'START_RECORDING'); }; rs.appendChild(rb); container.appendChild(rs);
            var us = document.createElement('div'); us.style.marginTop = '15px';
            us.innerHTML = '<div style="font-weight:bold; border-bottom:1px solid #333; padding-bottom:4px; margin-bottom:8px;">Project Utilities</div>';
            var rlb = document.createElement('button'); rlb.className = 'action-btn'; rlb.style.width = '100%'; rlb.innerHTML = '🔄 Force Reload Project';
            rlb.onclick = function () { sendAction('RELOAD_PAGE'); }; us.appendChild(rlb); container.appendChild(us);
        }
    });

    // --- BOOT ---
    buildUI();
    connectWS();

    window.atlasRenderer = { sendAction: sendAction, state: state };
})();
