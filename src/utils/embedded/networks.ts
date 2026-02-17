
export const NETWORKS = `
// networks.js
(function () {
    let requests = [];
    let activeType = 'all';
    let searchQuery = '';
    let listEl = null;
    let countEl = null;
    let lastFetchCount = 0;

    const ICONS = {
        TRASH: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>'
    };

    const TYPE_MAP = {
        'fetch': 'XHR', 'xhr': 'XHR', 'document': 'Doc', 'script': 'JS',
        'stylesheet': 'CSS', 'image': 'IMG', 'font': 'Font', 'media': 'Media',
        'Fetch': 'XHR'
    };

    const STATUS_COLORS = {
        '2': '#10b981', '3': '#3b82f6', '4': '#f59e0b', '5': '#ef4444'
    };

    const METHOD_COLORS = {
        'GET': '#3b82f6', 'POST': '#10b981', 'PUT': '#f59e0b',
        'DELETE': '#ef4444', 'PATCH': '#a855f7', 'OPTIONS': '#71717a'
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
            renderRequests();
        };
    }

    // Sync from backend — uses _page field set by network-manager
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

        // Only show requests whose _page matches the current page
        let filtered = requests.filter(r => {
            if (!r._page) return true; // no tag = legacy, show it
            return normalizePath(r._page) === currentPage;
        });

        if (activeType !== 'all') {
            filtered = filtered.filter(r => {
                const mapped = TYPE_MAP[r.type] || TYPE_MAP[r.resourceType] || 'Other';
                return mapped === activeType;
            });
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(r => (r.url || '').toLowerCase().includes(q));
        }
        return filtered;
    };

    const renderRequests = () => {
        if (!listEl) return;
        const filtered = getFilteredRequests();

        if (countEl) countEl.innerText = filtered.length;

        listEl.innerHTML = '';
        if (filtered.length === 0) {
            listEl.innerHTML = '<div style="color:#52525b; text-align:center; padding-top:40px; font-style:italic; font-size:13px;">No requests on this page yet.</div>';
            return;
        }

        [...filtered].reverse().forEach(req => {
            const item = document.createElement('div');
            const statusChar = String(req.status || 0).charAt(0);
            const statusColor = STATUS_COLORS[statusChar] || '#71717a';
            const methodColor = METHOD_COLORS[req.method] || '#71717a';

            item.style.cssText = 'padding:8px 10px; background:rgba(255,255,255,0.02); border-radius:5px; cursor:pointer; transition:background 0.15s; border-left:3px solid ' + statusColor + ';';
            item.onmouseover = () => { item.style.background = 'rgba(255,255,255,0.05)'; };
            item.onmouseout = () => { item.style.background = 'rgba(255,255,255,0.02)'; };

            let displayUrl = req.url || '';
            try {
                const u = new URL(displayUrl);
                displayUrl = u.pathname + u.search;
            } catch (e) {}
            if (displayUrl.length > 55) displayUrl = displayUrl.substring(0, 52) + '...';

            const type = TYPE_MAP[req.type] || TYPE_MAP[req.resourceType] || 'Other';

            const main = document.createElement('div');
            main.style.cssText = 'display:flex; align-items:center; gap:8px; font-size:12px; font-family:\\'JetBrains Mono\\',monospace;';
            main.innerHTML = ''
                + '<span style="background:' + methodColor + '22; color:' + methodColor + '; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; min-width:36px; text-align:center;">' + (req.method || 'GET') + '</span>'
                + '<span style="color:#e4e4e7; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="' + (req.url || '').replace(/"/g, '&quot;') + '">' + displayUrl + '</span>'
                + '<span style="color:' + statusColor + '; font-weight:700; font-size:12px;">' + (req.status || '—') + '</span>'
                + '<span style="color:#71717a; font-size:11px; min-width:48px; text-align:right;">' + (req.time ? req.time + 'ms' : '—') + '</span>'
                + '<span style="color:#3f3f46; font-size:10px; font-weight:500;">' + type + '</span>';
            item.appendChild(main);

            // Expandable details
            const details = document.createElement('div');
            details.style.cssText = 'display:none; margin-top:10px; font-size:12px; font-family:\\'JetBrains Mono\\',monospace;';

            let detailsHtml = '<div style="color:#10b981; font-weight:700; margin-bottom:6px; font-size:12px;">Request Headers</div>';
            if (req.reqHeaders) {
                detailsHtml += '<div style="background:#0a0a0a; padding:8px; border-radius:4px; border:1px solid #1f1f23; max-height:140px; overflow-y:auto; margin-bottom:10px;">';
                Object.entries(req.reqHeaders).forEach(([k, v]) => {
                    detailsHtml += '<div style="padding:1px 0; font-size:11px;"><span style="color:#3b82f6;">' + k + '</span>: <span style="color:#d4d4d8;">' + v + '</span></div>';
                });
                detailsHtml += '</div>';
            }

            detailsHtml += '<div style="color:#f59e0b; font-weight:700; margin-bottom:6px; font-size:12px;">Response Headers</div>';
            if (req.resHeaders) {
                detailsHtml += '<div style="background:#0a0a0a; padding:8px; border-radius:4px; border:1px solid #1f1f23; max-height:140px; overflow-y:auto; margin-bottom:10px;">';
                Object.entries(req.resHeaders).forEach(([k, v]) => {
                    detailsHtml += '<div style="padding:1px 0; font-size:11px;"><span style="color:#f59e0b;">' + k + '</span>: <span style="color:#d4d4d8;">' + v + '</span></div>';
                });
                detailsHtml += '</div>';
            }

            if (req.body) {
                detailsHtml += '<div style="color:#a855f7; font-weight:700; margin-bottom:6px; font-size:12px;">Response Body</div>';
                const bodyText = String(req.body).length > 2000 ? String(req.body).substring(0, 2000) + '\\n... (truncated)' : String(req.body);
                detailsHtml += '<pre style="background:#0a0a0a; padding:8px; border-radius:4px; border:1px solid #1f1f23; max-height:220px; overflow:auto; color:#d4d4d8; white-space:pre-wrap; word-break:break-all; font-size:11px; line-height:1.4;">' + bodyText.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>';
            }

            details.innerHTML = detailsHtml;
            item.appendChild(details);

            item.onclick = () => {
                const vis = details.style.display === 'block';
                details.style.display = vis ? 'none' : 'block';
            };

            listEl.appendChild(item);
        });
    };

    window.Atlas.addTool('Networks', function () {
        const container = document.createElement('div');
        container.style.cssText = 'display:flex; flex-direction:column; height:100%; gap:0;';

        const topBar = document.createElement('div');
        topBar.style.cssText = 'display:flex; gap:4px; padding:8px 10px; background:rgba(0,0,0,0.3); border-bottom:1px solid #1f1f23; align-items:center; flex-wrap:wrap;';

        const types = [
            { key: 'all', label: 'All' }, { key: 'XHR', label: 'XHR' },
            { key: 'Doc', label: 'Doc' }, { key: 'JS', label: 'JS' },
            { key: 'CSS', label: 'CSS' }, { key: 'IMG', label: 'Img' }
        ];

        types.forEach(t => {
            const btn = document.createElement('button');
            btn.style.cssText = 'background:' + (t.key === 'all' ? 'rgba(255,255,255,0.1)' : 'transparent') + '; border:1px solid ' + (t.key === 'all' ? 'rgba(255,255,255,0.2)' : 'transparent') + '; color:#aaa; padding:4px 10px; border-radius:5px; font-size:11px; cursor:pointer; font-weight:500;';
            btn.innerText = t.label;
            btn.onclick = () => {
                activeType = t.key;
                topBar.querySelectorAll('button').forEach(b => {
                    b.style.background = 'transparent';
                    b.style.borderColor = 'transparent';
                });
                btn.style.background = 'rgba(255,255,255,0.1)';
                btn.style.borderColor = 'rgba(255,255,255,0.2)';
                renderRequests();
            };
            topBar.appendChild(btn);
        });

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Filter URL...';
        searchInput.style.cssText = 'margin-left:8px; flex:1; background:#0a0a0a; border:1px solid #27272a; color:#d4d4d8; padding:4px 10px; border-radius:5px; font-size:12px; font-family:\\'JetBrains Mono\\',monospace; outline:none; min-width:80px;';
        searchInput.oninput = () => { searchQuery = searchInput.value; renderRequests(); };
        topBar.appendChild(searchInput);

        const badge = document.createElement('span');
        badge.style.cssText = 'background:#10b981; color:#000; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:700; margin-left:4px;';
        badge.innerText = '0';
        countEl = badge;
        topBar.appendChild(badge);

        const clearBtn = document.createElement('button');
        clearBtn.style.cssText = 'background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); color:#ef4444; padding:4px 8px; border-radius:5px; font-size:11px; cursor:pointer; margin-left:4px; display:flex; align-items:center;';
        clearBtn.innerHTML = ICONS.TRASH;
        clearBtn.onclick = () => { requests = []; if (window.clearNetworkHistory) window.clearNetworkHistory(); renderRequests(); };
        topBar.appendChild(clearBtn);

        container.appendChild(topBar);

        listEl = document.createElement('div');
        listEl.style.cssText = 'flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:4px; padding:10px;';
        container.appendChild(listEl);

        renderRequests();
        syncFromBackend();
        return container;
    }, function () {
        syncFromBackend();
        renderRequests();
    });
})();
`;
