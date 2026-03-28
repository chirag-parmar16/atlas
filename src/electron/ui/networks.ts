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

import { AtlasApi } from '../setup-api';

declare global {
    interface Window {
        Atlas: AtlasApi;
    }
}

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

function syntaxHighlightJSON(json: string) {
    if (!json) return '';
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, function (match) {
        let cls = 'color:#f87171'; // number
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'color:#818cf8'; // key
            } else {
                cls = 'color:#34d399'; // string
            }
        } else if (/true|false/.test(match)) {
            cls = 'color:#fbbf24'; // boolean
        } else if (/null/.test(match)) {
            cls = 'color:#a1a1aa'; // null
        }
        return `<span style="${cls}">${match}</span>`;
    });
}

function renderDetails(selectedRequest: NetworkRequest) {
    const detailsContainer = document.createElement('div');
    detailsContainer.style.cssText = 'background:rgba(0,0,0,0.6); border-top:1px solid rgba(255,255,255,0.08); border-bottom:1px solid rgba(255,255,255,0.08); overflow:hidden; animation: slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1); position:relative;';

    const tabsNav = document.createElement('div');
    tabsNav.style.cssText = 'display:flex; background:rgba(255, 255, 255, 0.02); border-bottom:1px solid rgba(255,255,255,0.05); padding:0 12px; align-items:center;';

    const contentArea = document.createElement('div');
    contentArea.style.cssText = 'max-height:400px; overflow-y:auto; background:transparent;';

    const copyBtn = document.createElement('button');
    copyBtn.innerHTML = 'Copy';
    copyBtn.style.cssText = 'margin-left:auto; background:rgba(16, 185, 129, 0.1); border:1px solid rgba(16, 185, 129, 0.2); color:#10b981; padding:4px 10px; border-radius:4px; font-size:9px; font-weight:800; cursor:pointer; text-transform:uppercase; transition:all 0.2s;';
    copyBtn.onclick = (e) => {
        e.stopPropagation();
        const activeView = Object.entries(views).find(([_, v]) => v.style.display === 'block');
        if (activeView) {
            let textValue = activeView[1].innerText;
            if (activeView[0] === 'Headers') {
                // Formatting for headers copy
                textValue = Array.from(activeView[1].querySelectorAll('div')).map(row => {
                    const spans = row.querySelectorAll('span');
                    return spans.length >= 2 ? `${spans[0].innerText} ${spans[1].innerText}` : '';
                }).filter(t => t).join('\n');
            }
            navigator.clipboard.writeText(textValue);
            copyBtn.innerText = 'COPIED!';
            copyBtn.style.background = '#10b981';
            copyBtn.style.color = '#000';
            setTimeout(() => {
                copyBtn.innerText = 'COPY';
                copyBtn.style.background = 'rgba(16, 185, 129, 0.1)';
                copyBtn.style.color = '#10b981';
            }, 1000);
        }
    };

    const views: Record<string, HTMLElement> = {};
    const tabs = ['Headers', 'Preview', 'Raw', 'Timing'];

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
                const buttonElement = b as HTMLElement;
                if (buttonElement.innerText !== 'COPY') {
                    buttonElement.style.color = '#71717a';
                    buttonElement.style.borderBottomColor = 'transparent';
                }
            });
            Object.values(views).forEach(v => v.style.display = 'none');
            btn.style.color = '#10b981'; btn.style.borderBottomColor = '#10b981';
            view.style.display = 'block';
        };
    });
    tabsNav.appendChild(copyBtn);

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
        const rawContent = selectedRequest.body || '(No content recorded)';
        
        // 1. Raw view
        const resPre = document.createElement('pre');
        resPre.style.cssText = 'background:rgba(0, 0, 0, 0.4); padding:16px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); white-space:pre-wrap; word-break:break-all; font-family:"JetBrains Mono", monospace; font-size:10px; color:#10b981; line-height:1.5; margin:0;';
        resPre.textContent = rawContent;
        views['Raw'].appendChild(resPre);

        // 2. Preview view (Structured with Syntax Highlighting)
        let previewContent: HTMLElement;
        try {
            const parsed = JSON.parse(rawContent);
            const beautified = JSON.stringify(parsed, null, 2);
            const pre = document.createElement('pre');
            pre.style.cssText = 'background:rgba(0, 0, 0, 0.4); padding:16px; border-radius:8px; border:1px solid rgba(16, 185, 129, 0.2); white-space:pre-wrap; word-break:break-all; font-family:"JetBrains Mono", monospace; font-size:10px; color:#d4d4d8; line-height:1.5; margin:0;';
            pre.innerHTML = syntaxHighlightJSON(beautified);
            previewContent = pre;
        } catch (e) {
            const pre = document.createElement('pre');
            pre.style.cssText = 'background:rgba(255, 255, 255, 0.02); padding:16px; border-radius:8px; border:1px solid rgba(255,255,255,0.05); white-space:pre-wrap; word-break:break-all; font-family:"JetBrains Mono", monospace; font-size:10px; color:#d4d4d8; line-height:1.5; margin:0;';
            pre.textContent = rawContent;
            previewContent = pre;
        }
        views['Preview'].appendChild(previewContent);
    }

    const t = views['Timing'];
    const totalTime = Math.round(selectedRequest.time);
    const timingWrap = document.createElement('div');
    timingWrap.style.cssText = 'padding:10px 0;';
    
    const timeRow = (label: string, duration: number, color: string) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; gap:12px; margin-bottom:16px;';
        
        const labelEl = document.createElement('div');
        labelEl.style.cssText = 'width:100px; font-size:10px; color:#71717a; font-weight:700; text-transform:uppercase;';
        labelEl.innerText = label;
        
        const barContainer = document.createElement('div');
        barContainer.style.cssText = 'flex:1; height:8px; background:rgba(255,255,255,0.03); border-radius:4px; overflow:hidden; position:relative;';
        
        const bar = document.createElement('div');
        bar.style.cssText = `height:100%; width:100%; background:${color}; border-radius:4px; transform-origin:left; animation: growBar 0.5s cubic-bezier(0.16, 1, 0.3, 1);`;
        barContainer.appendChild(bar);
        
        const valueEl = document.createElement('div');
        valueEl.style.cssText = 'width:60px; font-size:11px; font-family:"JetBrains Mono", monospace; color:#d4d4d8; text-align:right; font-weight:700;';
        valueEl.innerText = `${duration} ms`;
        
        row.appendChild(labelEl);
        row.appendChild(barContainer);
        row.appendChild(valueEl);
        return row;
    };

    t.appendChild(section('Request Timing', '#fbbf24'));
    t.appendChild(timeRow('Total Duration', totalTime, 'linear-gradient(90deg, #fbbf24, #f59e0b)'));
    
    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:10px; color:#52525b; margin-top:20px; font-style:italic; line-height:1.4;';
    hint.innerText = 'Timing includes proxy overhead and localhost latency. More granular TCP/SSL breakdowns coming in future updates.';
    t.appendChild(hint);

    if (!document.getElementById('timing-style')) {
        const style = document.createElement('style');
        style.id = 'timing-style';
        style.textContent = `@keyframes growBar { from { transform: scaleX(0); } to { transform: scaleX(1); } }`;
        document.head.appendChild(style);
    }

    detailsContainer.appendChild(tabsNav);
    if (contentArea) {
        detailsContainer.appendChild(contentArea);
    }

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

    const clearBtn = document.createElement('button');
    clearBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>';
    clearBtn.title = 'Clear Network Log';
    clearBtn.style.cssText = 'background:transparent; border:none; color:#71717a; cursor:pointer; padding:4px; margin-left:8px; display:flex; align-items:center; justify-content:center; border-radius:4px; transition:all 0.2s;';
    clearBtn.onmouseover = () => { clearBtn.style.color = '#ef4444'; clearBtn.style.background = 'rgba(239, 68, 68, 0.1)'; };
    clearBtn.onmouseout = () => { clearBtn.style.color = '#71717a'; clearBtn.style.background = 'transparent'; };
    clearBtn.onclick = () => {
        // 1. Clear HUD memory
        atlas.clearTraffic();
        // 2. Clear Backend (Cli/Proxy) history
        // @ts-ignore
        if (window.__atlasClearTraffic) window.__atlasClearTraffic();
    };
    filterBar.appendChild(clearBtn);

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
