/**
 * Atlas UI — Networks Tab Component (High Fidelity)
 * 
 * Full Chrome DevTools style network monitor.
 * UPDATED: Added sticky headers, removed horizontal scroll, 
 * improved transparency, and refined grid layout.
 */

export function buildNetworksScript(): string {
    return `
(function () {
    let requests = [];
    let activeType = 'all';
    let searchQuery = '';
    let listEl = null;
    let countEl = null;

    const ICONS = {
        TRASH: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>'
    };

    const TYPE_MAP = {
        'fetch': 'XHR', 'xhr': 'XHR', 'document': 'Doc', 'script': 'JS',
        'stylesheet': 'CSS', 'image': 'IMG', 'font': 'Font', 'media': 'Media'
    };

    const STATUS_COLORS = { '2': '#10b981', '3': '#3b82f6', '4': '#facc15', '5': '#ef4444' };

    window.Atlas.logNetworkRequest = (data) => {
        requests.push(data);
        if (requests.length > 500) requests.shift();
        if (listEl) renderRequests();
    };

    const renderDetails = (req, container) => {
        container.innerHTML = '';
        const tabsNav = document.createElement('div');
        tabsNav.style.cssText = 'display:flex; background:rgba(24, 24, 27, 0.85); border-bottom:1px solid rgba(255,255,255,0.06); height:32px;';
        
        const views = {};
        ['Headers', 'Preview', 'Response', 'Cookies'].forEach((label, i) => {
            const btn = document.createElement('button');
            btn.innerText = label;
            btn.style.cssText = 'background:transparent; border:none; color:' + (i === 0 ? '#3b82f6' : '#a1a1aa') + '; padding:0 15px; font-size:12px; font-weight:bold; cursor:pointer; border-bottom:2px solid ' + (i === 0 ? '#3b82f6' : 'transparent');
            tabsNav.appendChild(btn);

            const view = document.createElement('div');
            view.style.cssText = 'flex:1; overflow-y:auto; padding:15px; color:#e4e4e7; font-size:11px; display:' + (i === 0 ? 'block' : 'none') + '; font-family:"JetBrains Mono", monospace;';
            views[label] = view;

            btn.onclick = () => {
                tabsNav.querySelectorAll('button').forEach(b => { b.style.color = '#a1a1aa'; b.style.borderBottomColor = 'transparent'; });
                Object.values(views).forEach(v => v.style.display = 'none');
                btn.style.color = '#3b82f6'; btn.style.borderBottomColor = '#3b82f6';
                view.style.display = 'block';
            };
        });

        views.Headers.innerHTML = '<div style="color:#3b82f6; font-weight:bold; margin-bottom:10px;">General</div><pre style="background:rgba(0,0,0,0.3); padding:10px; border-radius:4px; border:1px solid rgba(255,255,255,0.05);">' + JSON.stringify({ method: req.method, url: req.url, status: req.status }, null, 2) + '</pre>';
        if (req.reqHeaders) views.Headers.innerHTML += '<div style="color:#10b981; font-weight:bold; margin-top:10px; margin-bottom:5px;">Request Headers</div><pre style="background:rgba(0,0,0,0.3); padding:10px; border-radius:4px; border:1px solid rgba(255,255,255,0.05);">' + JSON.stringify(req.reqHeaders, null, 2) + '</pre>';
        if (req.resHeaders) views.Headers.innerHTML += '<div style="color:#ef4444; font-weight:bold; margin-top:10px; margin-bottom:5px;">Response Headers</div><pre style="background:rgba(0,0,0,0.3); padding:10px; border-radius:4px; border:1px solid rgba(255,255,255,0.05);">' + JSON.stringify(req.resHeaders, null, 2) + '</pre>';
        
        const isImage = ['image', 'IMG'].includes(TYPE_MAP[req.type] || req.type);
        if (isImage) {
            views.Preview.innerHTML = '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:15px; background:rgba(0,0,0,0.2); border-radius:8px; padding:20px;">' +
                '<img src="' + req.url + '" style="max-width:100%; max-height:200px; object-fit:contain; border:1px solid rgba(255,255,255,0.1); border-radius:4px; box-shadow:0 4px 12px rgba(0,0,0,0.5);" />' +
                '<div style="font-size:10px; color:#71717a;">' + req.url.split('/').pop() + '</div>' +
                '</div>';
        } else {
            views.Preview.innerHTML = '<pre style="background:rgba(0,0,0,0.3); padding:10px; border-radius:4px; border:1px solid rgba(255,255,255,0.05); white-space:pre-wrap; word-break:break-all;">' + (req.body || '(No content)') + '</pre>';
        }
        
        views.Response.innerHTML = '<pre style="background:rgba(0,0,0,0.3); padding:10px; border-radius:4px; border:1px solid rgba(255,255,255,0.05); white-space:pre-wrap; word-break:break-all;">' + (req.body || '(No content)') + '</pre>';
        views.Cookies.innerHTML = '<div style="padding:10px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.05); border-radius:4px;">Cookies recorded: <span style="color:#f59e0b">' + (req.reqHeaders && req.reqHeaders.cookie ? 'Yes' : 'No') + '</span></div>';

        container.appendChild(tabsNav);
        Object.values(views).forEach(v => container.appendChild(v));
    };

    const renderRequests = () => {
        if (!listEl) return;
        listEl.innerHTML = '';
        const filtered = requests.filter(r => {
            if (activeType !== 'all' && (TYPE_MAP[r.type] || 'Other') !== activeType) return false;
            if (searchQuery && !r.url.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            return true;
        });

        if (countEl) countEl.innerText = filtered.length;

        const table = document.createElement('div');
        table.style.cssText = 'display:flex; flex-direction:column; width:100%; font-family:"JetBrains Mono", monospace; font-size:11px; position:relative;';
        
        // --- STICKY HEADER ---
        const header = document.createElement('div');
        header.style.cssText = 'display:grid; grid-template-columns: 2fr 60px 60px 70px 65px; height:28px; align-items:center; padding:0 12px; background:rgba(39, 39, 42, 0.8); border-bottom:1px solid rgba(255,255,255,0.08); position:sticky; top:0; z-index:10; color:#a1a1aa; font-weight:bold; letter-spacing:0.5px;';
        header.innerHTML = '<span>Name</span><span>Status</span><span>Type</span><span>Size</span><span>Time</span>';
        table.appendChild(header);

        filtered.slice().reverse().forEach((req, idx) => {
            const row = document.createElement('div');
            row.style.cssText = 'display:grid; grid-template-columns: 2fr 60px 60px 70px 65px; height:26px; align-items:center; padding:0 12px; border-bottom:1px solid rgba(255,255,255,0.03); cursor:pointer; color:#e4e4e7;';
            if (idx % 2 === 0) row.style.background = 'rgba(255,255,255,0.015)';

            const urlParts = req.url.split('/');
            const fileName = urlParts.pop() || urlParts.pop() || req.url;
            
            row.innerHTML = '<span style="color:#ffffff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-right:8px;" title="' + req.url + '">' + fileName + '</span>' + 
                '<span style="color:' + (STATUS_COLORS[String(req.status)[0]] || '#a1a1aa') + '; font-weight:bold;">' + req.status + '</span>' +
                '<span style="color:#a1a1aa; opacity:0.8;">' + (TYPE_MAP[req.type] || 'Other') + '</span>' +
                '<span style="color:#a1a1aa; opacity:0.8;">' + (req.body ? (req.body.length / 1024).toFixed(1) + ' KB' : (req.size ? (req.size / 1024).toFixed(1) + ' KB' : '-')) + '</span>' +
                '<span style="color:#71717a;">' + (req.time ? Math.round(req.time) + 'ms' : '-') + '</span>';
            
            const details = document.createElement('div');
            details.style.cssText = 'display:none; height:300px; background:rgba(10, 10, 10, 0.6); overflow:hidden; flex-direction:column; border-bottom:2px solid #3b82f6;';
            row.onclick = () => {
                const vis = details.style.display === 'flex';
                details.style.display = vis ? 'none' : 'flex';
                if (!vis) renderDetails(req, details);
            };

            table.appendChild(row);
            table.appendChild(details);
        });
        
        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:#52525b; text-align:center; padding:40px 10px; font-style:italic;';
            empty.innerText = 'No network activity recorded.';
            table.appendChild(empty);
        }

        listEl.appendChild(table);
    };

    window.Atlas.addTool('Networks', function () {
        const container = document.createElement('div');
        container.style.cssText = 'display:flex; flex-direction:column; height:100%;';
        const topBar = document.createElement('div');
        topBar.style.cssText = 'display:flex; gap:10px; padding:8px 12px; background:rgba(24, 24, 27, 0.6); border-bottom:1px solid rgba(255,255,255,0.06); align-items:center;';

        ['all', 'XHR', 'Doc', 'JS', 'CSS', 'IMG'].forEach(t => {
            const btn = document.createElement('button');
            const active = activeType === t;
            btn.innerText = t;
            btn.style.cssText = 'background:' + (active ? 'rgba(255,255,255,0.08)' : 'transparent') + '; border:1px solid ' + (active ? 'rgba(255,255,255,0.1)' : 'transparent') + '; color:' + (active ? '#fff' : '#a1a1aa') + '; font-size:11px; cursor:pointer; padding:3px 8px; border-radius:4px; font-weight:bold;';
            btn.onclick = () => { 
                activeType = t; 
                topBar.querySelectorAll('button').forEach(b => { 
                    b.style.background = 'transparent'; 
                    b.style.color = '#a1a1aa'; 
                    b.style.border = '1px solid transparent'; 
                });
                btn.style.background = 'rgba(255,255,255,0.08)'; 
                btn.style.color = '#fff'; 
                btn.style.border = '1px solid rgba(255,255,255,0.1)';
                renderRequests(); 
            };
            topBar.appendChild(btn);
        });

        const search = document.createElement('input');
        search.placeholder = 'Filter requests...';
        search.style.cssText = 'flex:1; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.05); color:#fff; padding:5px 10px; font-size:11px; border-radius:4px; outline:none;';
        search.oninput = () => { searchQuery = search.value; renderRequests(); };
        topBar.appendChild(search);

        container.appendChild(topBar);
        listEl = document.createElement('div');
        listEl.style.cssText = 'flex:1; overflow-y:auto; background:transparent;';
        container.appendChild(listEl);
        renderRequests();
        return container;
    }, renderRequests);
})();
`;
}

export const NETWORKS = buildNetworksScript();
