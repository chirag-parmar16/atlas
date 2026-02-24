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
let renderTimeout: any = null;

const TYPE_MAP: Record<string, string> = {
    'fetch': 'XHR', 'xhr': 'XHR', 'document': 'Doc', 'script': 'JS',
    'stylesheet': 'CSS', 'image': 'IMG', 'font': 'Font', 'media': 'Media'
};

const STATUS_COLORS: Record<string, string> = { '2': '#10b981', '3': '#3b82f6', '4': '#facc15', '5': '#ef4444' };

const atlas = (window as any).Atlas;

function formatHeaders(headers: Record<string, string>) {
    const wrap = document.createDocumentFragment();
    Object.entries(headers).forEach(([key, val]) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; gap:10px; font-size:10px; font-family:"JetBrains Mono", monospace; padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.02);';
        row.innerHTML = `<span style="color:#71717a; width:110px; flex-shrink:0;">${key}:</span><span style="color:#e4e4e7; word-break:break-all;">${val}</span>`;
        wrap.appendChild(row);
    });
    return wrap;
}

function renderDetails(selectedRequest: NetworkRequest) {
    const detailsContainer = document.createElement('div');
    detailsContainer.style.cssText = 'background:rgba(0,0,0,0.5); border-top:1px solid rgba(255,255,255,0.08); border-bottom:1px solid rgba(255,255,255,0.08); overflow:hidden; animation: slideDown 0.15s ease-out;';

    const tabsNav = document.createElement('div');
    tabsNav.style.cssText = 'display:flex; background:rgba(255, 255, 255, 0.02); border-bottom:1px solid rgba(255,255,255,0.05); padding:0 12px;';

    const contentArea = document.createElement('div');
    contentArea.style.cssText = 'max-height:350px; overflow-y:auto; background:transparent;';

    const views: Record<string, HTMLElement> = {};
    const tabs = ['Headers', 'Preview', 'Response', 'Cookies'];

    tabs.forEach((label, i) => {
        const btn = document.createElement('button');
        btn.innerText = label;
        const active = i === 0;
        btn.style.cssText = `background:transparent; border:none; color:${active ? '#3b82f6' : '#71717a'}; padding:8px 10px; font-size:9px; font-weight:bold; cursor:pointer; border-bottom:2px solid ${active ? '#3b82f6' : 'transparent'}; transition:all 0.15s; text-transform:uppercase; letter-spacing:0.03em;`;
        tabsNav.appendChild(btn);

        const view = document.createElement('div');
        view.style.cssText = `padding:12px; color:#e4e4e7; font-size:10px; display:${active ? 'block' : 'none'};`;
        views[label] = view;
        contentArea.appendChild(view);

        btn.onclick = (e) => {
            e.stopPropagation();
            tabsNav.querySelectorAll('button').forEach(b => {
                (b as HTMLElement).style.color = '#71717a';
                (b as HTMLElement).style.borderBottomColor = 'transparent';
            });
            Object.values(views).forEach(v => v.style.display = 'none');
            btn.style.color = '#3b82f6'; btn.style.borderBottomColor = '#3b82f6';
            view.style.display = 'block';
        };
    });

    const h = views['Headers'];
    const section = (name: string, color: string) => {
        const s = document.createElement('div');
        s.style.cssText = `color:${color}; font-weight:800; font-size:8px; text-transform:uppercase; margin-bottom:8px; letter-spacing:0.05em; display:flex; align-items:center; gap:6px; margin-top:8px;`;
        s.innerHTML = `<span>${name}</span><div style="flex:1; height:1px; background:rgba(255,255,255,0.04);"></div>`;
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

    const isImage = ['image', 'IMG'].includes(TYPE_MAP[selectedRequest.type] || selectedRequest.type);
    if (isImage) {
        views['Preview'].innerHTML = `<div style="display:flex; justify-content:center; padding:8px; background:rgba(0,0,0,0.3); border-radius:4px; border:1px solid rgba(255,255,255,0.05);">
            <img src="${selectedRequest.url}" style="max-width:100%; max-height:180px; border-radius:2px;" />
        </div>`;
    } else {
        const code = selectedRequest.body || '(No content recorded)';
        const pre = document.createElement('pre');
        pre.style.cssText = 'background:rgba(0, 0, 0, 0.3); padding:10px; border-radius:4px; border:1px solid rgba(255,255,255,0.05); white-space:pre-wrap; word-break:break-all; font-family:"JetBrains Mono", monospace; font-size:9px; color:#a7f3d0; line-height:1.4; margin:0;';
        pre.textContent = code;
        views['Preview'].appendChild(pre);
        views['Response'].innerHTML = views['Preview'].innerHTML;
    }

    detailsContainer.appendChild(tabsNav);
    detailsContainer.appendChild(contentArea);
    return detailsContainer;
}

function renderRequests() {
    if (!containerEl) return;

    // Clear efficiently
    while (containerEl.firstChild) containerEl.removeChild(containerEl.firstChild);

    if (!document.getElementById('networks-style')) {
        const style = document.createElement('style');
        style.id = 'networks-style';
        style.textContent = `
            @keyframes slideDown { from { max-height: 0; opacity: 0; } to { max-height: 500px; opacity: 1; } }
            .net-row:hover { background: rgba(255,255,255,0.03) !important; }
            .net-row.expanded { background: rgba(59, 130, 246, 0.08) !important; }
        `;
        document.head.appendChild(style);
    }

    const filterBar = document.createElement('div');
    filterBar.style.cssText = 'display:flex; gap:8px; padding:10px 12px; background:rgba(20, 20, 20, 0.4); border-bottom:1px solid rgba(255,255,255,0.05); align-items:center; position:sticky; top:0; z-index:10;';

    const filterTabs = document.createElement('div');
    filterTabs.style.cssText = 'display:flex; gap:3px;';

    ['all', 'XHR', 'Doc', 'JS', 'CSS', 'IMG'].forEach(type => {
        const btn = document.createElement('button');
        const active = activeType === type;
        btn.style.cssText = `background:${active ? 'rgba(255,255,255,0.1)' : 'transparent'}; color:${active ? '#fff' : '#52525b'}; padding:4px 10px; border-radius:4px; font-size:9px; cursor:pointer; border:none; font-weight:800; transition:all 0.15s; text-transform:uppercase;`;
        btn.innerText = type;
        btn.onclick = () => { activeType = type; renderRequests(); };
        filterTabs.appendChild(btn);
    });
    filterBar.appendChild(filterTabs);

    const search = document.createElement('input');
    search.placeholder = 'Filter...';
    search.value = searchQuery;
    search.style.cssText = 'background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.08); color:#fff; padding:5px 10px; border-radius:6px; font-size:10px; flex:1; outline:none;';
    search.oninput = (e) => { searchQuery = (e.target as HTMLInputElement).value; renderRequests(); };
    filterBar.appendChild(search);

    containerEl.appendChild(filterBar);

    const scrollArea = document.createElement('div');
    scrollArea.style.cssText = 'flex:1; overflow-y:auto; position:relative;';

    const filtered = requests.filter(r => {
        if (activeType !== 'all' && (TYPE_MAP[r.type] || 'Other') !== activeType) return false;
        if (searchQuery && !r.url.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    }).slice(-100); // Limit to 100 items for performance

    if (filtered.length === 0) {
        scrollArea.innerHTML = `<div style="color:#3f3f46; text-align:center; padding-top:40px; font-style:italic; font-size:11px;">No requests recorded locally.</div>`;
    } else {
        const fragment = document.createDocumentFragment();
        filtered.slice().reverse().forEach(req => {
            const isExpanded = expandedRequestId === req.id;
            const rowWrapper = document.createElement('div');
            rowWrapper.style.cssText = 'display:flex; flex-direction:column; border-bottom:1px solid rgba(255,255,255,0.03);';

            const row = document.createElement('div');
            row.className = `net-row ${isExpanded ? 'expanded' : ''}`;
            row.style.cssText = `display:flex; align-items:center; padding:10px 12px; cursor:pointer; font-size:10px; gap:8px; transition:all 0.1s; position:relative;`;

            const nameEl = document.createElement('div');
            nameEl.style.cssText = 'flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#d4d4d8; font-weight:600;';
            const urlParts = req.url.split('/');
            nameEl.innerText = urlParts.pop() || urlParts.pop() || req.url;
            row.appendChild(nameEl);

            const status = String(req.status || '0');
            const color = STATUS_COLORS[status[0]] || '#71717a';
            const statusEl = document.createElement('div');
            statusEl.style.cssText = `width:35px; color:${color}; font-weight:800; text-align:center;`;
            statusEl.innerText = status === '0' ? 'ERR' : status;
            row.appendChild(statusEl);

            const sizeKb = (req.size / 1024).toFixed(1);
            const sizeEl = document.createElement('div');
            sizeEl.style.cssText = 'width:55px; color:#52525b; text-align:right; font-weight:500;';
            sizeEl.innerText = sizeKb + ' KB';
            row.appendChild(sizeEl);

            const timeEl = document.createElement('div');
            timeEl.style.cssText = 'width:50px; color:#52525b; text-align:right; font-weight:500;';
            timeEl.innerText = Math.round(req.time) + 'ms';
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
    containerEl.appendChild(scrollArea);
}

function throttledRender() {
    if (renderTimeout) return;
    renderTimeout = requestAnimationFrame(() => {
        renderRequests();
        renderTimeout = null;
    });
}

function render() {
    throttledRender();
}

atlas.on('networkTrafficUpdated', (reqs: NetworkRequest[]) => {
    requests = reqs;
    throttledRender();
});

atlas.addTool('Networks', function () {
    containerEl = document.createElement('div');
    containerEl.style.cssText = 'display:flex; flex-direction:column; height:100%; background:transparent;';
    render();
    return containerEl;
}, render);

export { };
