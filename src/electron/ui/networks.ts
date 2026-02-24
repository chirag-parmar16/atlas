(function () {
    interface NetworkRequest {
        id: string;
        url: string;
        method: string;
        status: number;
        type: string;
        reqHeaders?: Record<string, string>;
        resHeaders?: Record<string, string>;
        body?: string;
    }

    let requests: NetworkRequest[] = [];
    let activeType: string = 'all';
    let searchQuery: string = '';
    let listEl: HTMLElement | null = null;
    let countEl: HTMLElement | null = null;

    const ICONS = {
        TRASH: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>'
    };

    const TYPE_MAP: Record<string, string> = {
        'fetch': 'XHR', 'xhr': 'XHR', 'document': 'Doc', 'script': 'JS',
        'stylesheet': 'CSS', 'image': 'IMG', 'font': 'Font', 'media': 'Media'
    };

    const STATUS_COLORS: Record<string, string> = { '2': '#10b981', '3': '#3b82f6', '4': '#facc15', '5': '#ef4444' };

    const atlas = (window as any).Atlas;

    // React to live traffic updates
    atlas.onNetworkTrafficUpdated = (reqs: NetworkRequest[]) => {
        requests = reqs;
        if (listEl) renderRequests();
    };

    const renderDetails = (req: NetworkRequest, container: HTMLElement) => {
        container.innerHTML = '';
        const tabsNav = document.createElement('div');
        tabsNav.style.cssText = 'display:flex; background:rgba(24, 24, 27, 0.85); border-bottom:1px solid rgba(255,255,255,0.06); height:32px;';

        const views: Record<string, HTMLElement> = {};
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

        views['Headers'].innerHTML = '<div style="color:#3b82f6; font-weight:bold; margin-bottom:10px;">General</div><pre style="background:rgba(0,0,0,0.3); padding:10px; border-radius:4px; border:1px solid rgba(255,255,255,0.05);">' + JSON.stringify({ method: req.method, url: req.url, status: req.status }, null, 2) + '</pre>';
        if (req.reqHeaders) views['Headers'].innerHTML += '<div style="color:#10b981; font-weight:bold; margin-top:10px; margin-bottom:5px;">Request Headers</div><pre style="background:rgba(0,0,0,0.3); padding:10px; border-radius:4px; border:1px solid rgba(255,255,255,0.05);">' + JSON.stringify(req.reqHeaders, null, 2) + '</pre>';
        if (req.resHeaders) views['Headers'].innerHTML += '<div style="color:#ef4444; font-weight:bold; margin-top:10px; margin-bottom:5px;">Response Headers</div><pre style="background:rgba(0,0,0,0.3); padding:10px; border-radius:4px; border:1px solid rgba(255,255,255,0.05);">' + JSON.stringify(req.resHeaders, null, 2) + '</pre>';

        const isImage = ['image', 'IMG'].includes(TYPE_MAP[req.type] || req.type);
        if (isImage) {
            views['Preview'].innerHTML = '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:15px; background:rgba(0,0,0,0.2); border-radius:8px; padding:20px;">' +
                '<img src="' + req.url + '" style="max-width:100%; max-height:200px; object-fit:contain; border:1px solid rgba(255,255,255,0.1); border-radius:4px; box-shadow:0 4px 12px rgba(0,0,0,0.5);" />' +
                '<div style="font-size:10px; color:#71717a;">' + req.url.split('/').pop() + '</div>' +
                '</div>';
        } else {
            views['Preview'].innerHTML = '<pre style="background:rgba(0,0,0,0.3); padding:10px; border-radius:4px; border:1px solid rgba(255,255,255,0.05); white-space:pre-wrap; word-break:break-all;">' + (req.body || '(No content)') + '</pre>';
        }

        views['Response'].innerHTML = '<pre style="background:rgba(0,0,0,0.3); padding:10px; border-radius:4px; border:1px solid rgba(255,255,255,0.05); white-space:pre-wrap; word-break:break-all;">' + (req.body || '(No content)') + '</pre>';
        views['Cookies'].innerHTML = '<div style="padding:10px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.05); border-radius:4px;">Cookies recorded: <span style="color:#f59e0b">' + (req.reqHeaders && req.reqHeaders['cookie'] ? 'Yes' : 'No') + '</span></div>';

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

        if (countEl) countEl.innerText = String(filtered.length);

        if (filtered.length === 0) {
            listEl.innerHTML = '<div style="color:#52525b; text-align:center; padding-top:40px; font-style:italic; font-size:13px;">No requests recorded.</div>';
            return;
        }

        filtered.slice().reverse().forEach(req => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:center; padding:8px 12px; border-bottom:1px solid rgba(255,255,255,0.03); cursor:pointer; font-size:11px; transition:background 0.2s;';
            row.onmouseover = () => row.style.backgroundColor = 'rgba(255,255,255,0.03)';
            row.onmouseout = () => row.style.backgroundColor = 'transparent';

            const status = String(req.status || '0');
            const color = STATUS_COLORS[status[0]] || '#71717a';

            row.innerHTML = '<div style="width:30px; color:' + color + '; font-weight:bold;">' + status + '</div>' +
                '<div style="width:40px; color:#71717a; font-weight:bold;">' + req.method + '</div>' +
                '<div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:0 10px; color:#fff;">' + req.url.split('/').pop() + '</div>' +
                '<div style="width:40px; color:#52525b; text-align:right;">' + (TYPE_MAP[req.type] || 'Other') + '</div>';

            row.onclick = () => {
                const modal = document.createElement('div');
                modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); backdrop-filter:blur(8px); z-index:10000; display:flex; align-items:center; justify-content:center;';
                const inner = document.createElement('div');
                inner.style.cssText = 'width:90%; height:90%; background:#18181b; border:1px solid rgba(255,255,255,0.1); border-radius:12px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.5);';

                const closeBtn = document.createElement('button');
                closeBtn.innerHTML = '&times;';
                closeBtn.style.cssText = 'position:absolute; top:20px; right:20px; color:#fff; background:transparent; border:none; font-size:30px; cursor:pointer; z-index:10001;';
                closeBtn.onclick = () => modal.remove();
                modal.appendChild(closeBtn);

                renderDetails(req, inner);
                modal.appendChild(inner);
                document.body.appendChild(modal);
            };
            listEl!.appendChild(row);
        });
    };

    atlas.addTool('Networks', function () {
        const container = document.createElement('div');
        container.style.cssText = 'display:flex; flex-direction:column; height:100%; background:transparent;';

        const filterBar = document.createElement('div');
        filterBar.style.cssText = 'display:flex; gap:10px; padding:10px 12px; background:rgba(24, 24, 27, 0.8); border-bottom:1px solid rgba(255,255,255,0.06); align-items:center;';

        const search = document.createElement('input');
        search.placeholder = 'Filter URL...';
        search.style.cssText = 'background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:#fff; padding:4px 10px; border-radius:4px; font-size:11px; flex:1; outline:none;';
        search.oninput = (e) => {
            searchQuery = (e.target as HTMLInputElement).value;
            renderRequests();
        };
        filterBar.appendChild(search);

        ['all', 'Doc', 'JS', 'XHR', 'CSS', 'IMG'].forEach(type => {
            const btn = document.createElement('button');
            const active = activeType === type;
            btn.style.cssText = 'background:' + (active ? 'rgba(255,255,255,0.08)' : 'transparent') + '; color:' + (active ? '#fff' : '#a1a1aa') + '; padding:4px 8px; border-radius:4px; font-size:10px; cursor:pointer; border:none; font-weight:bold;';
            btn.innerText = type.toUpperCase();
            btn.onclick = () => {
                activeType = type;
                filterBar.querySelectorAll('button').forEach(b => {
                    (b as HTMLElement).style.background = 'transparent';
                    (b as HTMLElement).style.color = '#a1a1aa';
                });
                btn.style.background = 'rgba(255,255,255,0.08)';
                btn.style.color = '#fff';
                renderRequests();
            };
            filterBar.appendChild(btn);
        });

        countEl = document.createElement('span');
        countEl.style.cssText = 'color:#10b981; font-weight:bold; font-size:11px; font-family:monospace; margin-left:auto;';
        countEl.innerText = String(requests.length);
        filterBar.appendChild(countEl);

        container.appendChild(filterBar);
        listEl = document.createElement('div');
        listEl.style.cssText = 'flex:1; overflow-y:auto; background:transparent;';
        container.appendChild(listEl);
        renderRequests();
        return container;
    }, renderRequests);
})();
export { };

