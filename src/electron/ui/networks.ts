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

const TYPE_MAP: Record<string, string> = {
    'fetch': 'XHR', 'xhr': 'XHR', 'document': 'Doc', 'script': 'JS',
    'stylesheet': 'CSS', 'image': 'IMG', 'font': 'Font', 'media': 'Media'
};

const STATUS_COLORS: Record<string, string> = { '2': '#10b981', '3': '#3b82f6', '4': '#facc15', '5': '#ef4444' };

const atlas = (window as any).Atlas;

function formatHeaders(headers: Record<string, string>) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex; flex-direction:column; gap:4px;';
    Object.entries(headers).forEach(([key, val]) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; gap:10px; font-size:11px; font-family:"JetBrains Mono", monospace; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.02);';
        row.innerHTML = `<span style="color:#71717a; width:140px; flex-shrink:0;">${key}:</span><span style="color:#e4e4e7; word-break:break-all;">${val}</span>`;
        wrap.appendChild(row);
    });
    return wrap;
}

function renderDetails(selectedRequest: NetworkRequest) {
    const detailsContainer = document.createElement('div');
    detailsContainer.style.cssText = 'background:rgba(0,0,0,0.4); border-top:1px solid rgba(255,255,255,0.08); border-bottom:1px solid rgba(255,255,255,0.08); margin:0; padding:0; overflow:hidden; animation: slideDown 0.2s ease-out;';

    const tabsNav = document.createElement('div');
    tabsNav.style.cssText = 'display:flex; background:rgba(255, 255, 255, 0.03); border-bottom:1px solid rgba(255,255,255,0.06); padding:0 15px;';

    const contentArea = document.createElement('div');
    contentArea.style.cssText = 'max-height:400px; overflow-y:auto; background:transparent;';

    const views: Record<string, HTMLElement> = {};
    ['Headers', 'Preview', 'Response', 'Cookies'].forEach((label, i) => {
        const btn = document.createElement('button');
        btn.innerText = label;
        const active = i === 0;
        btn.style.cssText = `background:transparent; border:none; color:${active ? '#3b82f6' : '#71717a'}; padding:8px 12px; font-size:10px; font-weight:bold; cursor:pointer; border-bottom:2px solid ${active ? '#3b82f6' : 'transparent'}; transition:color 0.2s; text-transform:uppercase; letter-spacing:0.05em;`;
        tabsNav.appendChild(btn);

        const view = document.createElement('div');
        view.style.cssText = `padding:15px; color:#e4e4e7; font-size:11px; display:${active ? 'block' : 'none'};`;
        views[label] = view;
        contentArea.appendChild(view);

        btn.onclick = (e) => {
            e.stopPropagation(); // Don't collapse accordion
            tabsNav.querySelectorAll('button').forEach(b => {
                (b as HTMLElement).style.color = '#71717a';
                (b as HTMLElement).style.borderBottomColor = 'transparent';
            });
            Object.values(views).forEach(v => v.style.display = 'none');
            btn.style.color = '#3b82f6'; btn.style.borderBottomColor = '#3b82f6';
            view.style.display = 'block';
        };
    });

    // Populate Headers
    const h = views['Headers'];
    const section = (name: string, color: string) => {
        const s = document.createElement('div');
        s.style.cssText = `color:${color}; font-weight:800; font-size:9px; text-transform:uppercase; margin-bottom:10px; letter-spacing:0.05em; display:flex; align-items:center; gap:8px; margin-top:10px;`;
        s.innerHTML = `<span>${name}</span><div style="flex:1; height:1px; background:rgba(255,255,255,0.05);"></div>`;
        return s;
    };

    h.appendChild(section('General', '#3b82f6'));
    h.appendChild(formatHeaders({
        'Request URL': selectedRequest.url,
        'Request Method': selectedRequest.method,
        'Status Code': String(selectedRequest.status)
    }));

    if (selectedRequest.resHeaders) {
        h.appendChild(section('Response Headers', '#ef4444'));
        h.appendChild(formatHeaders(selectedRequest.resHeaders));
    }

    if (selectedRequest.reqHeaders) {
        h.appendChild(section('Request Headers', '#10b981'));
        h.appendChild(formatHeaders(selectedRequest.reqHeaders));
    }

    // Populate Preview/Response
    const isImage = ['image', 'IMG'].includes(TYPE_MAP[selectedRequest.type] || selectedRequest.type);
    if (isImage) {
        views['Preview'].innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:10px; background:rgba(0,0,0,0.2); border-radius:4px;">
            <img src="${selectedRequest.url}" style="max-width:100%; max-height:200px; border-radius:2px;" />
        </div>`;
    } else {
        const code = selectedRequest.body || '(No content recorded)';
        const pre = document.createElement('pre');
        pre.style.cssText = 'background:rgba(0, 0, 0, 0.2); padding:12px; border-radius:4px; border:1px solid rgba(255,255,255,0.05); white-space:pre-wrap; word-break:break-all; font-family:"JetBrains Mono", monospace; font-size:10px; color:#a7f3d0; line-height:1.5; margin:0;';
        pre.textContent = code;
        views['Preview'].appendChild(pre);
        views['Response'].innerHTML = views['Preview'].innerHTML;
    }

    views['Cookies'].innerHTML = `<div style="padding:10px; background:rgba(0,0,0,0.2); border-radius:4px; font-size:10px;">
        <div style="color:#71717a;">${selectedRequest.reqHeaders && selectedRequest.reqHeaders['cookie'] ? 'Cookies were sent with this request.' : 'No cookies were detected.'}</div>
    </div>`;

    detailsContainer.appendChild(tabsNav);
    detailsContainer.appendChild(contentArea);
    return detailsContainer;
}

function renderRequests() {
    if (!containerEl) return;
    containerEl.innerHTML = '';

    // Inject keyframes for accordion animation
    if (!document.getElementById('networks-style')) {
        const style = document.createElement('style');
        style.id = 'networks-style';
        style.textContent = `
            @keyframes slideDown {
                from { max-height: 0; opacity: 0; }
                to { max-height: 600px; opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    // Header / Filter Bar
    const filterBar = document.createElement('div');
    filterBar.style.cssText = 'display:flex; gap:10px; padding:12px 15px; background:rgba(24, 24, 27, 0.2); border-bottom:1px solid rgba(255,255,255,0.06); align-items:center; position:sticky; top:0; z-index:10;';

    const filterTabs = document.createElement('div');
    filterTabs.style.cssText = 'display:flex; gap:4px;';

    ['all', 'XHR', 'Doc', 'JS', 'CSS', 'IMG'].forEach(type => {
        const btn = document.createElement('button');
        const active = activeType === type;
        btn.style.cssText = `background:${active ? 'rgba(255,255,255,0.08)' : 'transparent'}; color:${active ? '#fff' : '#71717a'}; padding:5px 12px; border-radius:4px; font-size:10px; cursor:pointer; border:none; font-weight:800; transition:all 0.2s; text-transform:uppercase;`;
        btn.innerText = type;
        btn.onclick = () => {
            activeType = type;
            renderRequests();
        };
        filterTabs.appendChild(btn);
    });
    filterBar.appendChild(filterTabs);

    const search = document.createElement('input');
    search.placeholder = 'Filter requests...';
    search.value = searchQuery;
    search.style.cssText = 'background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:#fff; padding:6px 14px; border-radius:8px; font-size:11px; flex:1; outline:none; transition:all 0.2s;';
    search.onfocus = () => search.style.borderColor = '#3b82f6';
    search.onblur = () => search.style.borderColor = 'rgba(255,255,255,0.1)';
    search.oninput = (e) => {
        searchQuery = (e.target as HTMLInputElement).value;
        renderRequests();
    };
    filterBar.appendChild(search);

    containerEl.appendChild(filterBar);

    // List View
    const scrollArea = document.createElement('div');
    scrollArea.style.cssText = 'flex:1; overflow-y:auto; position:relative;';

    const filtered = requests.filter(r => {
        if (activeType !== 'all' && (TYPE_MAP[r.type] || 'Other') !== activeType) return false;
        if (searchQuery && !r.url.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    if (filtered.length === 0) {
        scrollArea.innerHTML = `<div style="color:#52525b; text-align:center; padding-top:60px; font-style:italic; font-size:12px;">No requests found.</div>`;
    } else {
        filtered.slice().reverse().forEach(req => {
            const isExpanded = expandedRequestId === req.id;

            const rowWrapper = document.createElement('div');
            rowWrapper.style.cssText = 'display:flex; flex-direction:column;';

            const row = document.createElement('div');
            row.style.cssText = `display:flex; align-items:center; padding:12px 15px; border-bottom:1px solid rgba(255,255,255,0.03); cursor:pointer; font-size:11px; transition:all 0.1s; gap:10px; background:${isExpanded ? 'rgba(59, 130, 246, 0.05)' : 'transparent'};`;
            row.onmouseover = () => { if (!isExpanded) row.style.backgroundColor = 'rgba(255,255,255,0.02)'; };
            row.onmouseout = () => { if (!isExpanded) row.style.backgroundColor = 'transparent'; };

            const nameEl = document.createElement('div');
            nameEl.style.cssText = 'flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#e4e4e7; font-weight:600; font-family:"JetBrains Mono", monospace;';
            const urlParts = req.url.split('/');
            nameEl.innerText = urlParts.pop() || urlParts.pop() || req.url;
            nameEl.title = req.url;
            row.appendChild(nameEl);

            const status = String(req.status || '0');
            const color = STATUS_COLORS[status[0]] || '#71717a';
            const statusEl = document.createElement('div');
            statusEl.style.cssText = `width:50px; color:${color}; font-weight:800; text-align:center;`;
            statusEl.innerText = status === '0' ? 'ERR' : status;
            row.appendChild(statusEl);

            const typeEl = document.createElement('div');
            typeEl.style.cssText = 'width:60px; color:#52525b; text-align:center; font-weight:bold; font-size:10px; text-transform:uppercase;';
            typeEl.innerText = (TYPE_MAP[req.type] || 'Other');
            row.appendChild(typeEl);

            const sizeKb = (req.size / 1024).toFixed(1);
            const sizeEl = document.createElement('div');
            sizeEl.style.cssText = 'width:70px; color:#52525b; text-align:right; font-family:monospace;';
            sizeEl.innerText = sizeKb + ' KB';
            row.appendChild(sizeEl);

            const timeEl = document.createElement('div');
            timeEl.style.cssText = 'width:60px; color:#52525b; text-align:right; font-family:monospace;';
            timeEl.innerText = Math.round(req.time) + 'ms';
            row.appendChild(timeEl);

            row.onclick = () => {
                expandedRequestId = isExpanded ? null : req.id;
                renderRequests();
            };

            rowWrapper.appendChild(row);
            if (isExpanded) {
                rowWrapper.appendChild(renderDetails(req));
            }

            scrollArea.appendChild(rowWrapper);
        });
    }
    containerEl.appendChild(scrollArea);
}

function render() {
    renderRequests();
}

atlas.on('networkTrafficUpdated', (reqs: NetworkRequest[]) => {
    requests = reqs;
    renderRequests();
});

atlas.addTool('Networks', function () {
    containerEl = document.createElement('div');
    containerEl.style.cssText = 'display:flex; flex-direction:column; height:100%; background:transparent;';
    render();
    return containerEl;
}, render);

export { };
