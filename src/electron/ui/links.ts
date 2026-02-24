(function () {
    let containerEl: HTMLElement | null = null;

    interface LinkEntry {
        href: string;
        text: string;
    }

    const renderLinks = () => {
        if (!containerEl) return;
        containerEl.innerHTML = '';

        const linksData: LinkEntry[] = (window as any).__ATLAS_LINKS__ || [];
        const internal: LinkEntry[] = [], external: LinkEntry[] = [], self: LinkEntry[] = [];

        const params = new URLSearchParams(window.location.search);
        const domain = params.get('domain') || '';

        linksData.forEach(link => {
            const href = link.href;
            if (!href) return;
            if (href.startsWith('#') || href.startsWith('javascript:')) self.push(link);
            else if (href.includes(domain) || href.startsWith('/') || !href.includes('://')) internal.push(link);
            else external.push(link);
        });

        const createSection = (title: string, list: LinkEntry[], color: string) => {
            const section = document.createElement('div');
            section.style.cssText = 'margin-bottom:12px; background:rgba(0,0,0,0.2); padding:14px; border-radius:8px; border:1px solid rgba(255,255,255,0.06); transition: border-color 0.2s;';
            section.onmouseover = () => section.style.borderColor = 'rgba(255,255,255,0.1)';
            section.onmouseout = () => section.style.borderColor = 'rgba(255,255,255,0.06)';

            const header = document.createElement('div');
            header.style.cssText = 'font-weight:800; color:#fff; font-size:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:10px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; text-transform:uppercase; letter-spacing:0.05em;';
            header.innerHTML = `<span>${title}</span>` +
                `<span style="background:${color}22; color:${color}; padding:2px 10px; border-radius:12px; font-size:10px; border:1px solid ${color}44; font-weight:900;">${list.length}</span>`;
            section.appendChild(header);

            const ul = document.createElement('div');
            ul.style.cssText = 'display:flex; flex-direction:column; gap:8px;';

            if (list.length === 0) {
                ul.innerHTML = '<div style="color:#52525b; font-size:11px; font-style:italic; padding:10px; text-align:center; font-family:\'Inter\',sans-serif;">No links detected for this category.</div>';
            }

            list.forEach(link => {
                const item = document.createElement('div');
                item.style.cssText = 'font-size:11px; color:#d4d4d8; word-break:break-all; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.03); opacity:0.95; font-family:\'Inter\', sans-serif;';
                item.innerHTML = `<span style="color:${color}; margin-right:10px; font-weight:800; font-size:12px;">→</span>` +
                    `<span style="font-weight:600;">${link.text || '(No Title)'}</span>` +
                    `<div style="color:#71717a; font-family:'JetBrains Mono', monospace; font-size:10px; margin-top:4px; opacity:0.8;">${link.href.replace(/</g, '&lt;')}</div>`;
                item.title = link.href;
                ul.appendChild(item);
            });
            section.appendChild(ul);
            containerEl!.appendChild(section);
        };

        createSection('Internal Links', internal, '#10b981');
        createSection('External Links', external, '#3b82f6');
        createSection('Anchor Fragments', self, '#f59e0b');
    };

    const atlas = (window as any).Atlas;
    atlas.on('linksUpdated', () => renderLinks());

    atlas.addTool('Links', function () {
        containerEl = document.createElement('div');
        containerEl.style.cssText = 'padding:15px; display:flex; flex-direction:column; height:100%; overflow-y:auto; background:transparent;';
        renderLinks();
        return containerEl;
    }, renderLinks);
})();
export { };
