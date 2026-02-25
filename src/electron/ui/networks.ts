interface NetworkRequest {
    id: string;
    url: string;
    method: string;
    status: number;
    type: string;
    size: number;
    time: number;
    reqHeaders?: Record<string, string>;
    resHeaders?: Record<string, string>;
    body?: string;
    timestamp: number;
}

let requests: NetworkRequest[] = [];
let activeType: string = 'all';
let searchQuery: string = '';
let containerEl: HTMLElement | null = null;
let expandedRequestId: string | null = null;
let renderTimeout: number | null = null;

const TYPE_MAP: Record<string, string> = {
    'fetch': 'XHR', 'xhr': 'XHR', 'document': 'Doc', 'script': 'JS',
    'stylesheet': 'CSS', 'image': 'Img', 'font': 'Font', 'media': 'Media'
};

const STATUS_COLORS: Record<string, string> = { '2': '#10b981', '3': '#3b82f6', '4': '#facc15', '5': '#ef4444' };

const atlas = window.Atlas;

function formatHeaders(headers: Record<string, string>) {
    const wrap = document.createDocumentFragment();
    Object.entries(headers).forEach(([key, val]) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; gap:12px; font-size:11px; font-family:"JetBrains Mono", monospace; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.03);';
        row.innerHTML = `<span style="color:#71717a; width:130px; flex-shrink:0;">${key}:</span><span style="color:#d4d4d8; word-break:break-all;">${val}</span>`;
        wrap.appendChild(row);
    });
    return wrap;
}

function renderDetails(selectedRequest: NetworkRequest) {
    const detailsContainer = document.createElement('div');
    detailsContainer.style.cssText = 'background:rgba(0,0,0,0.6); border-top:1px solid rgba(255,255,255,0.08); border-bottom:1px solid rgba(255,255,255,0.08); overflow:hidden; animation: slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);';

    const tabsNav = document.createElement('div');
    tabsNav.style.cssText = 'display:flex; background:rgba(255, 255, 255, 0.02); border-bottom:1px solid rgba(255,255,255,0.05); padding:0 12px;';

    const contentArea = document.createElement('div');
    contentArea.style.cssText = 'max-height:400px; overflow-y:auto; background:transparent;';

    const views: Record<string, HTMLElement> = {};
    const tabs = ['Headers', 'Preview', 'Response', 'Timing'];

    tabs.forEach((label, i) => {
        const btn = document.createElement('button');
        btn.innerText = label;
        const active = i === 0;
        btn.style.cssText = `background:transparent; border:none; color:${active ? '#10b981' : '#71717a'}; padding:10px 12px; font-size:10px; font-weight:700; cursor:pointer; border-bottom:2px solid ${active ? '#10b981' : 'transparent'}; transition:all 0.2s; text-transform:uppercase; letter-spacing:0.04em;`;
        tabsNav.appendChild(btn);

        const view = document.createElement('div');
        view.style.cssText = `padding:14px; color:#d4d4d8; font-size:11px; display:${active ? 'block' : 'none'};`;
        views[label] = view;
        contentArea.appendChild(view);

        btn.onclick = (e) => {
            e.stopPropagation();
            tabsNav.querySelectorAll('button').forEach(b => {
                (b as HTMLElement).style.color = '#71717a';
                (b as HTMLElement).style.borderBottomColor = 'transparent';
            });
            Object.values(views).forEach(v => v.style.display = 'none');
            btn.style.color = '#10b981'; btn.style.borderBottomColor = '#10b981';
            view.style.display = 'block';
        };
    });

    const h = views['Headers'];
    const section = (name: string, color: string) => {
        const s = document.createElement('div');
        s.style.cssText = `color:${color}; font-weight:800; font-size:9px; text-transform:uppercase; margin-bottom:10px; letter-spacing:0.06em; display:flex; align-items:center; gap:8px; margin-top:10px;`;
        s.innerHTML = `<span>${name}</span><div style="flex:1; height:1px; background:rgba(255,255,255,0.06);"></div>`;
        return s;
    };

    h.appendChild(section('General', '#3b82f6'));
    const genList = document.createElement('div');
    genList.appendChild(formatHeaders({
        'Request URL': selectedRequest.url,
        'Request Method': selectedRequest.method,
        'Status Code': String(selectedRequest.status)
    }));
    h.appendChild(genList);

    if (selectedRequest.resHeaders) {
        h.appendChild(section('Response Headers', '#ef4444'));
        h.appendChild(formatHeaders(selectedRequest.resHeaders));
    }

    const isImage = ['image', 'Img'].includes(TYPE_MAP[selectedRequest.type] || selectedRequest.type);
    if (isImage) {
        views['Preview'].innerHTML = `<div style="display:flex; justify-content:center; padding:12px; background:rgba(0,0,0,0.4); border-radius:6px; border:1px solid rgba(255,255,255,0.06);">
            <img src="${selectedRequest.url}" style="max-width:100%; max-height:220px; border-radius:4px;" />
        </div>`;
    } else {
        const code = selectedRequest.body || '(No content recorded)';
        const pre = document.createElement('pre');
        pre.style.cssText = 'background:rgba(0, 0, 0, 0.4); padding:16px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); white-space:pre-wrap; word-break:break-all; font-family:"JetBrains Mono", monospace; font-size:10px; color:#10b981; line-height:1.5; margin:0;';
        pre.textContent = code;
        views['Preview'].appendChild(pre);
        views['Response'].appendChild(pre.cloneNode(true));
    }

    detailsContainer.appendChild(tabsNav);
    detailsContainer.appendChild(contentArea);
    return detailsContainer;
}

function renderRequests() {
    if (!containerEl) return;

    while (containerEl.firstChild) containerEl.removeChild(containerEl.firstChild);

    if (!document.getElementById('networks-style')) {
        const style = document.createElement('style');
        style.id = 'networks-style';
        style.textContent = `
            @keyframes slideDown { from { max-height: 0; opacity: 0; } to { max-height: 500px; opacity: 1; } }
            .net-row { font-family: 'Inter', sans-serif; height: 32px; border-bottom: 1px solid rgba(255,255,255,0.02); }
            .net-row:hover { background: rgba(255,255,255,0.04) !important; }
            .net-row.expanded { background: rgba(16, 185, 129, 0.08) !important; }
            .net-header { padding: 4px 12px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 10px; color: #71717a; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 8px; }
            .net-col-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .net-col-status { width: 50px; text-align: center; }
            .net-col-type { width: 60px; text-align: left; }
            .net-col-init { width: 60px; text-align: left; }
            .net-col-size { width: 70px; text-align: right; }
            .net-col-time { width: 70px; text-align: right; }
        `;
        document.head.appendChild(style);
    }

    const filterBar = document.createElement('div');
    filterBar.className = 'tool-bar';
    filterBar.style.padding = '10px 14px';

    const filterTabs = document.createElement('div');
    filterTabs.style.cssText = 'display:flex; gap:4px;';

    ['all', 'XHR', 'Doc', 'JS', 'CSS', 'Img'].forEach(type => {
        const btn = document.createElement('button');
        const active = activeType === type;
        btn.style.cssText = `background:${active ? 'rgba(255,255,255,0.1)' : 'transparent'}; color:${active ? '#fff' : '#71717a'}; padding:5px 10px; border-radius:6px; font-size:10px; cursor:pointer; border:none; font-weight:700; transition:all 0.15s; text-transform:uppercase;`;
        btn.innerText = type;
        btn.onclick = () => { activeType = type; renderRequests(); };
        filterTabs.appendChild(btn);
    });
    filterBar.appendChild(filterTabs);

    const searchWrapper = document.createElement('div');
    searchWrapper.style.cssText = 'flex:1; display:flex; align-items:center; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:0 10px; margin-left:12px;';
    const search = document.createElement('input');
    search.placeholder = 'Filter requests...';
    search.value = searchQuery;
    search.style.cssText = 'background:transparent; border:none; color:#fff; padding:6px 0; font-size:11px; width:100%; outline:none;';
    search.oninput = (e) => { searchQuery = (e.target as HTMLInputElement).value; renderRequests(); };
    searchWrapper.appendChild(search);

    const countBadge = document.createElement('span');
    countBadge.style.cssText = 'background:#10b981; color:#000; font-size:10px; font-weight:900; padding:1px 6px; border-radius:10px; margin-left:10px;';
    countBadge.innerText = String(requests.length);
    filterBar.appendChild(searchWrapper);
    filterBar.appendChild(countBadge);

    containerEl.appendChild(filterBar);

    // --- BLACK BOX CONTAINER ---
    const blackBox = document.createElement('div');
    blackBox.className = 'black-box';

    // Table Header
    const header = document.createElement('div');
    header.className = 'net-header';
    header.innerHTML = `
        <div class="net-col-name">Name</div>
        <div class="net-col-status">Status</div>
        <div class="net-col-type">Type</div>
        <div class="net-col-init">Init</div>
        <div class="net-col-size">Size</div>
        <div class="net-col-time">Time</div>
    `;
    blackBox.appendChild(header);

    const scrollArea = document.createElement('div');
    scrollArea.style.cssText = 'flex:1; overflow-y:auto; position:relative;';

    const filtered = requests.filter(r => {
        if (activeType !== 'all' && (TYPE_MAP[r.type] || 'Other') !== activeType) return false;
        if (searchQuery && !r.url.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    }).slice(-100);

    if (filtered.length === 0) {
        scrollArea.innerHTML = `<div style="color:#52525b; text-align:center; padding-top:60px; font-style:italic; font-size:12px; font-family:'Inter',sans-serif;">No requests detected for this page.</div>`;
    } else {
        const fragment = document.createDocumentFragment();
        filtered.slice().reverse().forEach(req => {
            const isExpanded = expandedRequestId === req.id;
            const rowWrapper = document.createElement('div');
            rowWrapper.style.cssText = 'display:flex; flex-direction:column;';

            const row = document.createElement('div');
            row.className = `net-row ${isExpanded ? 'expanded' : ''}`;
            row.style.cssText = `display:flex; align-items:center; padding:0 12px; cursor:pointer; font-size:11px; gap:8px; transition:all 0.1s; position:relative;`;

            const nameEl = document.createElement('div');
            nameEl.className = 'net-col-name';
            nameEl.style.fontWeight = '500';
            const urlParts = req.url.split('/');
            nameEl.innerText = urlParts.pop() || urlParts.pop() || req.url;
            row.appendChild(nameEl);

            const status = String(req.status || '0');
            const color = STATUS_COLORS[status[0]] || '#71717a';
            const statusEl = document.createElement('div');
            statusEl.className = 'net-col-status';
            statusEl.style.cssText += `color:${color}; font-weight:700; font-family:'JetBrains Mono', monospace;`;
            statusEl.innerText = status === '0' ? 'ERR' : status;
            row.appendChild(statusEl);

            const typeEl = document.createElement('div');
            typeEl.className = 'net-col-type';
            typeEl.style.color = '#71717a';
            typeEl.innerText = TYPE_MAP[req.type] || 'Other';
            row.appendChild(typeEl);

            const initEl = document.createElement('div');
            initEl.className = 'net-col-init';
            initEl.style.color = '#71717a';
            initEl.innerText = 'Other';
            row.appendChild(initEl);

            const sizeKb = (req.size / 1024).toFixed(1);
            const sizeEl = document.createElement('div');
            sizeEl.className = 'net-col-size';
            sizeEl.style.cssText += `color:#d4d4d8; font-family:'JetBrains Mono', monospace;`;
            sizeEl.innerText = sizeKb + ' KB';
            row.appendChild(sizeEl);

            const timeEl = document.createElement('div');
            timeEl.className = 'net-col-time';
            timeEl.style.cssText += `color:#d4d4d8; font-family:'JetBrains Mono', monospace;`;
            timeEl.innerText = Math.round(req.time) + ' ms';
            row.appendChild(timeEl);

            row.onclick = () => {
                expandedRequestId = isExpanded ? null : req.id;
                renderRequests();
            };

            rowWrapper.appendChild(row);
            if (isExpanded) rowWrapper.appendChild(renderDetails(req));
            fragment.appendChild(rowWrapper);
        });
        scrollArea.appendChild(fragment);
    }
    blackBox.appendChild(scrollArea);
    containerEl.appendChild(blackBox);
}

function throttledRender() {
    if (renderTimeout) return;
    renderTimeout = requestAnimationFrame(() => {
        renderRequests();
        renderTimeout = null;
    });
}

atlas.on('networkTrafficUpdated', (reqs: NetworkRequest[]) => {
    requests = reqs;
    throttledRender();
});

atlas.addTool('Networks', function () {
    containerEl = document.createElement('div');
    containerEl.style.cssText = 'display:flex; flex-direction:column; height:100%; background:transparent;';
    throttledRender();
    return containerEl;
}, throttledRender);

export { };
