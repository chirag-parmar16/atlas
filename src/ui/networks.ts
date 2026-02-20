
export const NETWORKS = `
// networks.js
(function () {
    let requests = [];
    let activeType = 'all';
    let searchQuery = '';
    let listEl = null;
    let countEl = null;
    let lastFetchCount = 0;
    let currentPagePath = window.location.pathname;

    const ICONS = {
        TRASH: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
        AUDIT: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>'
    };

    const TYPE_MAP = {
        'fetch': 'XHR', 'xhr': 'XHR', 'document': 'Doc', 'script': 'JS',
        'stylesheet': 'CSS', 'image': 'IMG', 'font': 'Font', 'media': 'Media',
        'Fetch': 'XHR',
        'Audit': 'Audit'
    };

    const STATUS_COLORS = {
        '2': '#10b981', '3': '#3b82f6', '4': '#f59e0b', '5': '#ef4444'
    };

    // Normalize paths so /, /index.html, /index.htm are treated as the same page
    const normalizePath = (p) => {
        return (p || '/').replace(/\\/(index\\.html?)?$/, '/') || '/';
    };

    const getCurrentPage = () => normalizePath(window.location.pathname);

    // Live network request logger
    if (!window.Atlas.logNetworkRequest) {
        window.Atlas.logNetworkRequest = (data) => {
            requests.push(data);
            if (requests.length > 300) requests.shift();
            // Debounce render slightly to avoid massive updates
            if (!window.Atlas._renderTimeout) {
                window.Atlas._renderTimeout = setTimeout(() => {
                    renderRequests();
                    window.Atlas._renderTimeout = null;
                }, 100);
            }
        };
    }

    // Sync from backend
    const syncFromBackend = async () => {
        try {
            if (window.getNetworkHistory) {
                const history = await window.getNetworkHistory();
                if (history && history.length > lastFetchCount) {
                    const newEntries = history.slice(lastFetchCount);
                    newEntries.forEach(entry => {
                        const exists = requests.some(r => r.id === entry.id);
                        if (!exists) requests.push(entry);
                    });
                    lastFetchCount = history.length;
                    if (requests.length > 300) requests.splice(0, requests.length - 300);
                    renderRequests();
                }
            }
        } catch (e) {}
    };

    setInterval(syncFromBackend, 3000);

    const getFilteredRequests = () => {
        const currentPage = getCurrentPage();

        // Only show requests whose _page matches the current page (or legacy untagged ones)
        let filtered = requests.filter(r => {
            if (!r._page) return true;
            return normalizePath(r._page) === currentPage;
        });

        if (activeType !== 'all') {
            // Filter by specific type
            filtered = filtered.filter(r => {
                let rType = TYPE_MAP[r.type] || TYPE_MAP[r.resourceType] || 'Other';
                
                // If browser says 'Doc' (e.g. viewing css directly), check extension
                if (rType === 'Doc' || rType === 'Other') {
                    const u = (r.url || '').split('?')[0].toLowerCase();
                    if (u.endsWith('.css')) rType = 'CSS';
                    else if (u.endsWith('.js')) rType = 'JS';
                    else if (u.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/)) rType = 'IMG';
                }

                return rType === activeType;
            });
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(r => (r.url || '').toLowerCase().includes(q));
        }
        return filtered;
    };

    // Render detailed view for a single request (LAZY LOADING)
    const renderDetails = (req, container) => {
        container.innerHTML = ''; // Clear loading state
        
        // Tab Navigation
        const tabsNav = document.createElement('div');
        tabsNav.style.cssText = 'display:flex; background:#292a2d; border-bottom:1px solid #3c4043; height:28px; flex-shrink:0;';
        
        const createTab = (label, active = false) => {
            const btn = document.createElement('button');
            btn.innerText = label;
            btn.style.cssText = \`background:transparent; border:none; color:\${active ? '#8ab4f8' : '#9aa0a6'}; padding:0 10px; font-size:11px; cursor:pointer; height:100%; border-bottom:2px solid \${active ? '#8ab4f8' : 'transparent'}; font-family:monospace; white-space:nowrap;\`;
            return btn;
        };

        const tabLabels = ['Headers', 'Preview', 'Response', 'Cookies'];
        const tabs = {};
        const views = {};

        // Create Tab Buttons & View Containers
        tabLabels.forEach((label, i) => {
            const isFirst = i === 0;
            const btn = createTab(label, isFirst);
            tabs[label] = btn;
            tabsNav.appendChild(btn);

            const view = document.createElement('div');
            view.style.cssText = \`flex:1; overflow-y:auto; padding:10px; color:#e8eaed; display:\${isFirst ? 'block' : 'none'}; word-break:break-all;\`;
            views[label] = view;
        });

        // 1. HEADERS CONTENT (Grid Layout)
        let headersHtml = '<div style="display:flex; flex-direction:column; gap:16px;">';
        
        const renderSection = (title, items) => {
            let s = \`<div><div style="font-weight:700; color:#e8eaed; margin-bottom:6px; font-size:12px;">\${title}</div>\`;
            s += '<div style="display:grid; grid-template-columns: 140px 1fr; gap:4px 10px; font-size:11px;">';
            items.forEach(item => {
                s += \`<div style="color:#9aa0a6; font-weight:500;">\${item.label}:</div>\`;
                s += \`<div style="color:#e8eaed; word-break:break-all;">\${item.value}</div>\`;
            });
            s += '</div></div>';
            return s;
        };

        // General Section
        const statusChar = String(req.status || 0).charAt(0);
        const statusColor = STATUS_COLORS[statusChar] || '#9aa0a6';
        headersHtml += renderSection('General', [
            { label: 'Request URL', value: req.url },
            { label: 'Request Method', value: req.method },
            { label: 'Status Code', value: \`<span style="color:\${statusColor}">\${req.status}</span>\` },
            { label: 'Remote Address', value: '-' } // Placeholder
        ]);

        // Response Headers
        if (req.resHeaders && Object.keys(req.resHeaders).length > 0) {
           const items = Object.entries(req.resHeaders).map(([k, v]) => ({ label: k, value: v }));
           headersHtml += renderSection('Response Headers', items);
        }

        // Request Headers
        if (req.reqHeaders && Object.keys(req.reqHeaders).length > 0) {
            const items = Object.entries(req.reqHeaders).map(([k, v]) => ({ label: k, value: v }));
            headersHtml += renderSection('Request Headers', items);
        }

        headersHtml += '</div>';
        views['Headers'].innerHTML = headersHtml;

        // 2 & 3. PREVIEW & RESPONSE CONTENT (Optimized)
        // Truncate huge bodies to prevent UI freeze
        let bodyContent = req.body ? String(req.body) : '';
        const MAX_BODY_LENGTH = 10000; // 10KB limit for preview
        const truncated = bodyContent.length > MAX_BODY_LENGTH;
        if (truncated) bodyContent = bodyContent.substring(0, MAX_BODY_LENGTH) + '\\n... (Truncated for performance)';

        let isJson = false;
        try { JSON.parse(bodyContent); isJson = true; } catch(e){}

        if (isJson) {
            views['Preview'].innerHTML = \`<pre style="color:#a8c7fa; max-width:100%; white-space:pre-wrap;">\${bodyContent.replace(/</g, '&lt;')}</pre>\`;
        } else {
            views['Preview'].innerText = bodyContent || '(No content)';
        }
        
        views['Response'].innerText = bodyContent || '(No content)';

        // 4. COOKIES CONTENT
        let cookiesHtml = '<table><tr><th style="text-align:left; color:#9aa0a6;">Name</th><th style="text-align:left; color:#9aa0a6;">Value</th></tr>';
        const cookieHeader = (req.reqHeaders && (req.reqHeaders['cookie'] || req.reqHeaders['Cookie'])) || '';
        if (cookieHeader) {
            cookieHeader.split(';').forEach(c => {
                const [k, v] = c.split('=').map(s => s.trim());
                cookiesHtml += \`<tr><td style="color:#f28b82; padding-right:10px;">\${k}</td><td>\${v}</td></tr>\`;
            });
        } else {
            cookiesHtml += '<tr><td colspan="2" style="font-style:italic; color:#5f6368;">No cookies sent</td></tr>';
        }
        cookiesHtml += '</table>';
        views['Cookies'].innerHTML = cookiesHtml;

        // Assembly
        container.appendChild(tabsNav);
        Object.values(views).forEach(v => container.appendChild(v));

        // Tab Switching Logic
        Object.keys(tabs).forEach(key => {
            tabs[key].onclick = (e) => {
                e.stopPropagation();
                Object.values(tabs).forEach(t => { t.style.color = '#9aa0a6'; t.style.borderBottomColor = 'transparent'; });
                Object.values(views).forEach(v => v.style.display = 'none');
                
                tabs[key].style.color = '#8ab4f8';
                tabs[key].style.borderBottomColor = '#8ab4f8';
                views[key].style.display = 'block';
            };
        });
    };

    const renderRequests = () => {
        if (!listEl) return;
        const filtered = getFilteredRequests();

        if (countEl) countEl.innerText = String(filtered.length);

        listEl.innerHTML = '';
        if (filtered.length === 0) {
            listEl.innerHTML = '<div style="color:#52525b; text-align:center; padding-top:40px; font-style:italic; font-size:13px;">No requests match this filter.</div>';
            return;
        }

        const table = document.createElement('div');
        table.style.cssText = 'display:flex; flex-direction:column; height:100%; font-family:monospace; font-size:11px; color:#d4d4d8;';
        
        const header = document.createElement('div');
        header.style.cssText = 'display:grid; grid-template-columns: 2fr 50px 50px 50px 50px 50px; gap:0; background:#202124; border-bottom:1px solid #3c4043; color:#9aa0a6; font-weight:500; font-size:11px; height:24px; align-items:center; flex-shrink:0; padding-right:10px;';
        
        const hCell = (text, align = 'left', border = true) => 
            \`<div style="padding:0 5px; height:100%; display:flex; align-items:center; \${align === 'right' ? 'justify-content:flex-end;' : ''} \${border ? 'border-right:1px solid #3c4043;' : ''}">\${text}</div>\`;

        header.innerHTML = 
            hCell('Name') + 
            hCell('Status') + 
            hCell('Type') + 
            hCell('Init') + 
            hCell('Size', 'right') + 
            hCell('Time', 'right', false);
        
        table.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = 'flex:1; overflow-y:auto; overflow-x:hidden; background:#0d0d0d;';
        
        [...filtered].reverse().forEach((req, index) => {
            const row = document.createElement('div');
            const isEven = index % 2 === 0;
            
            row.style.cssText = \`display:grid; grid-template-columns: 2fr 50px 50px 50px 50px 50px; gap:0; border-bottom:1px solid #202124; cursor:pointer; align-items:center; height:24px; background:\${isEven ? '#0d0d0d' : '#121212'}; color:#e8eaed; transition:background 0.05s;\`;
            
            // Hover
            row.onmouseover = () => { if (detailsRow.style.display === 'none') row.style.background = '#2a2d32'; };
            row.onmouseout = () => { if (detailsRow.style.display === 'none') row.style.background = isEven ? '#0d0d0d' : '#121212'; };

            // Determine Data Colors/Text
            const statusChar = String(req.status || 0).charAt(0);
            const statusColor = STATUS_COLORS[statusChar] || '#9aa0a6';
            let rType = TYPE_MAP[req.type] || TYPE_MAP[req.resourceType] || 'Other';
            
            let displayUrl = req.url || '';
            let fileName = '';
            try {
                const u = new URL(displayUrl);
                fileName = u.pathname.split('/').pop() || '/';
                if (fileName === '/' && u.pathname !== '/') fileName = u.pathname;
                if (u.search) fileName += u.search;

                 const ext = u.pathname.split('.').pop()?.toLowerCase();
                 if (rType === 'Other') {
                    if (ext === 'css') rType = 'CSS';
                    else if (ext === 'js' || ext === 'mjs') rType = 'JS';
                    else if (['png','jpg','jpeg','gif','webp','svg'].includes(ext)) rType = 'Img';
                 }
            } catch (e) {
                fileName = displayUrl.substring(0, 30);
            }

            const timeColor = req.time > 1000 ? '#f28b82' : '#9aa0a6';
            const sizeStr = req.body ? Math.round(String(req.body).length / 1024) + ' KB' : '-';

            const cell = (html, align = 'left', border = true, color = null) => {
                const div = document.createElement('div');
                div.style.cssText = \`padding:0 5px; height:24px; display:flex; align-items:center; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; \${align === 'right' ? 'justify-content:flex-end;' : ''} \${border ? 'border-right:1px solid #202124;' : ''} \${color ? 'color:' + color : ''}\`;
                div.innerHTML = html;
                return div;
            };

            const nameDiv = cell(fileName, 'left', true);
            nameDiv.title = req.url; // Tooltip

            row.appendChild(nameDiv);
            row.appendChild(cell((req.status || 'pending'), 'left', true, statusColor));
            row.appendChild(cell(rType));
            row.appendChild(cell('Other', 'left', true, '#9aa0a6'));
            row.appendChild(cell(sizeStr, 'right'));
            row.appendChild(cell((req.time ? Math.round(req.time) + ' ms' : '...'), 'right', false, timeColor));

            // --- DETAILED VIEW CONTAINER (Lazy Rendered) ---
            const detailsRow = document.createElement('div');
            detailsRow.style.cssText = 'display:none; grid-column:1/-1; background:#202124; border-bottom:1px solid #3c4043; height:300px; overflow:hidden; flex-direction:column;';
            detailsRow.style.display = 'none'; // Ensure hidden initially
            
            // Flag to check if rendered
            let isRendered = false;

            row.onclick = () => {
                const vis = detailsRow.style.display === 'flex';
                
                if (vis) {
                    detailsRow.style.display = 'none';
                    row.style.background = isEven ? '#0d0d0d' : '#121212';
                } else {
                    // Lazy Render on first expand
                    if (!isRendered) {
                        renderDetails(req, detailsRow);
                        isRendered = true;
                    }
                    detailsRow.style.display = 'flex';
                    row.style.background = '#35363a';
                }
            };

            body.appendChild(row);
            body.appendChild(detailsRow);
        });

        table.appendChild(body);
        listEl.appendChild(table);
    };

    window.Atlas.addTool('Networks', function () {
        const container = document.createElement('div');
        container.className = 'atlas-networks-container'; // Global scope for this tab
        container.style.cssText = 'display:flex; flex-direction:column; height:100%; gap:0;';

        // --- CUSTOM SCROLLBAR STYLES ---
        const style = document.createElement('style');
        style.textContent = \`
            .atlas-networks-container ::-webkit-scrollbar { width: 10px !important; height: 10px !important; }
            .atlas-networks-container ::-webkit-scrollbar-track { background: #0d0d0d !important; border-left: 1px solid #202124 !important; }
            .atlas-networks-container ::-webkit-scrollbar-thumb { background: #3c4043 !important; border-radius: 0 !important; border: 2px solid #0d0d0d !important; }
            .atlas-networks-container ::-webkit-scrollbar-thumb:hover { background: #5f6368 !important; }
            .atlas-networks-container ::-webkit-scrollbar-corner { background: #0d0d0d !important; }
        \`;
        container.appendChild(style);

        const topBar = document.createElement('div');
        topBar.style.cssText = 'display:flex; gap:4px; padding:4px; background:#202124; border-bottom:1px solid #3c4043; align-items:center; flex-wrap:wrap; flex-shrink:0;';

        const types = [
            { key: 'all', label: 'All' },
            { key: 'XHR', label: 'Fetch/XHR' },
            { key: 'Doc', label: 'Doc' },
            { key: 'JS', label: 'JS' },
            { key: 'CSS', label: 'CSS' },
            { key: 'IMG', label: 'Img' }
        ];

        types.forEach(t => {
            const btn = document.createElement('button');
            const isActive = activeType === t.key;
            btn.style.cssText = 'background:' + (isActive ? '#35363a' : 'transparent') + '; border:none; color:' + (isActive ? '#fff' : '#9aa0a6') + '; padding:2px 8px; border-radius:2px; font-size:11px; cursor:pointer; font-weight:500; font-family:monospace;';
            btn.innerText = t.label;

            if (t.key === 'Audit') {
                btn.innerHTML = ICONS.AUDIT + ' Audit';
                btn.style.display = 'flex';
                btn.style.alignItems = 'center';
                btn.style.gap = '4px';
            }

            btn.onclick = () => {
                activeType = t.key;
                topBar.querySelectorAll('button').forEach(b => {
                    b.style.background = 'transparent';
                    b.style.color = '#9aa0a6';
                });
                btn.style.background = '#35363a';
                btn.style.color = '#fff';
                renderRequests();
            };
            topBar.appendChild(btn);
        });

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Filter';
        searchInput.style.cssText = 'margin-left:8px; flex:1; background:#000; border:1px solid #3c4043; color:#e8eaed; padding:2px 6px; border-radius:2px; font-size:11px; font-family:monospace; outline:none;';
        searchInput.oninput = () => { searchQuery = searchInput.value; renderRequests(); };
        topBar.appendChild(searchInput);

        const badge = document.createElement('span');
        badge.style.cssText = 'background:#10b981; color:#000; padding:1px 6px; border-radius:10px; font-size:10px; font-weight:700; margin-left:4px;';
        badge.innerText = '0';
        countEl = badge;
        topBar.appendChild(badge);

        const clearBtn = document.createElement('button');
        clearBtn.style.cssText = 'background:transparent; border:none; color:#9aa0a6; padding:2px 6px; cursor:pointer; margin-left:4px; font-size:11px;';
        clearBtn.title = 'Clear';
        clearBtn.innerHTML = ICONS.TRASH;
        clearBtn.onclick = () => { requests = []; if (window.clearNetworkHistory) window.clearNetworkHistory(); renderRequests(); };
        topBar.appendChild(clearBtn);

        container.appendChild(topBar);

        listEl = document.createElement('div');
        listEl.className = 'atlas-networks-list'; // Add class for styling
        listEl.style.cssText = 'flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:0; padding:0; background:#0d0d0d;';
        container.appendChild(listEl);

        currentPagePath = window.location.pathname;
        renderRequests();
        syncFromBackend();
        return container;
    }, function () {
        currentPagePath = window.location.pathname;
        syncFromBackend();
        renderRequests();
    });
}) ();
`;
