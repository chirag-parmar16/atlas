/**
 * Atlas GUI — Dashboard Renderer
 * Compiled by tsc as a plain (non-module) IIFE script.
 * NO ES module imports — globals come from window.atlasGui / window.atlasControls
 * set by the Electron contextBridge in preload.ts.
 */

// ─── Types and Global Declarations ──────────────────────────────────────
interface ProjectInfo {
    name: string; path: string;
    config: Record<string, unknown>;
    hasReports: boolean; reportCount: number;
}

interface ReportFile {
    name: string; path: string;
    projectPath: string;
    type: 'md' | 'mp4' | 'webm';
    size: number; modified: number;
}

interface AtlasGui {
    scanProjects: (rootPath?: string) => Promise<ProjectInfo[]>;
    getReportFiles: (projectPath: string) => Promise<ReportFile[]>;
    readFile: (filePath: string) => Promise<string>;
    browseFolder: () => Promise<string | undefined>;
    openProject: (projectPath: string) => Promise<void>;
}

interface AtlasControls {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
}

interface Window {
    atlasGui: AtlasGui;
    atlasControls: AtlasControls;
    marked: { parse(md: string): string };
    mermaid: { 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initialize(config: any): void;
        render(id: string, code: string): Promise<{ svg: string }>;
    };
}

(function () {
    'use strict';

    // ─── Safe bridge accessors ───────────────────────────────────────────────
    const bridge = {
        get gui() { return (window as unknown as Window).atlasGui; },
        get controls() { return (window as unknown as Window).atlasControls; }
    };

    // ─── Window Controls ─────────────────────────────────────────────────────
    window.addEventListener('DOMContentLoaded', () => {
        const minBtn = document.getElementById('gui-min-btn');
        const maxBtn = document.getElementById('gui-max-btn');
        const closeBtn = document.getElementById('gui-close-btn');
        if (minBtn) minBtn.onclick = () => bridge.controls?.minimize?.();
        if (maxBtn) maxBtn.onclick = () => bridge.controls?.maximize?.();
        if (closeBtn) closeBtn.onclick = () => bridge.controls?.close?.();
    });

    // ─── Utilities ───────────────────────────────────────────────────────────
    const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

    function escapeHtml(s: string): string {
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function formatSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    // ─── types ───────────────────────────────────────────────────────────────
    interface ReportTab {
        id: string; file: ReportFile;
        tabEl: HTMLElement; panelEl: HTMLElement;
    }

    // ─── ExplorerTree (VS Code Style) ────────────────────────────────────────
    class ExplorerTree {
        private container: HTMLElement;
        private projectNodes: Map<string, HTMLElement> = new Map();

        constructor(container: HTMLElement) {
            this.container = container;
        }

        render(projects: ProjectInfo[]) {
            this.container.innerHTML = '';
            if (projects.length === 0) {
                this.container.innerHTML = `<div class="project-list-empty"><p>No Atlas projects found.</p></div>`;
                return;
            }

            projects.forEach(project => {
                const node = this.createProjectNode(project);
                this.container.appendChild(node);
                this.projectNodes.set(project.path, node);
            });
        }

        private createProjectNode(project: ProjectInfo): HTMLElement {
            const node = document.createElement('div');
            node.className = 'tree-node collapsed';
            node.dataset.path = project.path;

            const item = document.createElement('div');
            item.className = 'tree-item';

            const chevron = `<span class="tree-item-chevron"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg></span>`;
            const icon = `<span class="tree-item-icon project"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>`;

            item.innerHTML = `
                ${chevron}
                ${icon}
                <span class="tree-item-name">${escapeHtml(project.name)}</span>
                <span class="tree-item-badge">${project.reportCount || ''}</span>
            `;

            const children = document.createElement('div');
            children.className = 'tree-children';

            item.onclick = async () => {
                const isCollapsed = node.classList.toggle('collapsed');
                if (!isCollapsed && children.children.length === 0) {
                    await this.loadProjectFiles(project, children);
                }
            };

            node.appendChild(item);
            node.appendChild(children);
            return node;
        }

        private async loadProjectFiles(project: ProjectInfo, container: HTMLElement) {
            container.innerHTML = `<div class="project-list-loading" style="padding:10px;"><div class="spinner"></div></div>`;
            try {
                const files: ReportFile[] = await bridge.gui.getReportFiles(project.path);
                container.innerHTML = '';

                if (files.length === 0) {
                    container.innerHTML = `<div class="tree-item" style="opacity:0.5; padding-left:32px;">No reports</div>`;
                    return;
                }

                // Build a nested structure from displayNames (names with slashes)
                const tree: Record<string, ReportFile | Record<string, unknown>> = {};
                files.forEach(f => {
                    const parts = f.name.split('/');
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    let curr: any = tree;
                    parts.forEach((p: string, i: number) => {
                        if (i === parts.length - 1) {
                            curr[p] = { ...f, projectPath: project.path };
                        } else {
                            if (!curr[p]) curr[p] = {};
                            curr = curr[p];
                        }
                    });
                });

                this.renderSubTree(tree, container, 1);

            } catch (err) {
                container.innerHTML = `<div class="project-list-error">Error loading files</div>`;
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private renderSubTree(subtree: Record<string, any>, container: HTMLElement, level: number) {
            const padding = 16 + (level * 12);
            Object.keys(subtree).sort().forEach(key => {
                const val = subtree[key];
                if (val.path) {
                    // It's a file
                    const file = val as ReportFile;
                    const item = document.createElement('div');
                    item.className = `tree-item file-${file.type}`;
                    item.style.paddingLeft = `${padding}px`;

                    const icon = file.type === 'md'
                        ? `<span class="tree-item-icon file-md"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>`
                        : `<span class="tree-item-icon file-video"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg></span>`;

                    item.innerHTML = `${icon}<span class="tree-item-name">${escapeHtml(key)}</span>`;
                    item.onclick = (e) => {
                        e.stopPropagation();
                        // Highlight active file
                        document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
                        item.classList.add('active');
                        reportTabManager?.openFile(file);
                    };
                    container.appendChild(item);
                } else {
                    // It's a folder
                    const node = document.createElement('div');
                    node.className = 'tree-node';
                    const item = document.createElement('div');
                    item.className = 'tree-item';
                    item.style.paddingLeft = `${padding - 12}px`;

                    const chevron = `<span class="tree-item-chevron"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg></span>`;
                    const icon = `<span class="tree-item-icon folder"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>`;

                    item.innerHTML = `${chevron}${icon}<span class="tree-item-name">${escapeHtml(key)}</span>`;

                    const children = document.createElement('div');
                    children.className = 'tree-children';
                    item.onclick = (e) => {
                        e.stopPropagation();
                        node.classList.toggle('collapsed');
                    };

                    node.appendChild(item);
                    node.appendChild(children);
                    this.renderSubTree(val, children, level + 1);
                    container.appendChild(node);
                }
            });
        }
    }

    // ─── ReportTabManager ────────────────────────────────────────────────────
    class ReportTabManager {
        private tabs: Map<string, ReportTab> = new Map();
        private activeId: string | null = null;
        private counter = 0;
        private tabContainer: HTMLElement;
        private panelContainer: HTMLElement;
        private noFilesEl: HTMLElement;

        constructor(tabContainer: HTMLElement, panelContainer: HTMLElement, noFilesEl: HTMLElement) {
            this.tabContainer = tabContainer;
            this.panelContainer = panelContainer;
            this.noFilesEl = noFilesEl;
        }

        async openFile(file: ReportFile): Promise<void> {
            // Show integrated view
            $('gui-welcome').style.display = 'none';
            $('gui-project-view').style.display = 'flex';

            for (const [id, tab] of this.tabs) {
                if (tab.file.path === file.path) { this.activateTab(id); return; }
            }

            const id = `rtab-${++this.counter}`;
            const basename = file.name.split('/').pop() || file.name;

            const icon = file.type === 'md'
                ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`
                : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;

            const tabEl = document.createElement('div');
            tabEl.className = 'rtab';
            tabEl.innerHTML = `
                <span class="rtab-icon">${icon}</span>
                <span class="rtab-title">${escapeHtml(basename)}</span>
                <button class="rtab-close" title="Close tab">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>`;

            tabEl.addEventListener('click', (e) => {
                if ((e.target as HTMLElement).closest('.rtab-close')) return;
                this.activateTab(id);
            });
            tabEl.querySelector('.rtab-close')!.addEventListener('click', (e) => {
                e.stopPropagation(); this.closeTab(id);
            });
            this.tabContainer.appendChild(tabEl);

            const panelEl = document.createElement('div');
            panelEl.className = 'report-panel';
            panelEl.innerHTML = `<div class="panel-loading"><div class="spinner"></div><span>Loading&hellip;</span></div>`;
            this.panelContainer.appendChild(panelEl);

            const tab: ReportTab = { id, file, tabEl, panelEl };
            this.tabs.set(id, tab);
            this.activateTab(id);
            this.noFilesEl.style.display = 'none';
            await this.loadContent(tab);
        }

        private async loadContent(tab: ReportTab): Promise<void> {
            const { file, panelEl } = tab;
            try {
                if (file.type === 'md') {
                    const raw = await bridge.gui.readFile(file.path);
                    const headerHtml = `
                        <div class="project-panel-header">
                            <div class="header-left">
                                <span class="text-muted" style="font-size: 11px;">Project: ${escapeHtml(file.projectPath.split(/[\\/]/).pop() || '')}</span>
                            </div>
                            <button class="open-project-btn" id="open-project-${tab.id}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                Open Project in IDE
                            </button>
                        </div>
                    `;
                    panelEl.innerHTML = headerHtml + `<div class="md-viewer">${this.renderMarkdown(raw)}</div>`;
                    
                    // Attach click handler
                    const btn = document.getElementById(`open-project-${tab.id}`);
                    if (btn) {
                        btn.onclick = () => bridge.gui.openProject(file.projectPath);
                    }

                    // Initialize and render Mermaid diagrams
                    await this.processMermaid(panelEl);
                } else {
                    const fileUri = 'file:///' + file.path.replace(/\\/g, '/');
                    panelEl.innerHTML = `
                        <div class="video-viewer">
                            <div class="video-info">
                                <span class="video-name">${escapeHtml(file.name)}</span>
                                <span class="video-size">${formatSize(file.size)}</span>
                            </div>
                            <video class="atlas-video" controls preload="metadata">
                                <source src="${fileUri}" type="video/${file.type === 'mp4' ? 'mp4' : 'webm'}">
                            </video>
                        </div>`;
                }
            } catch (err) {
                panelEl.innerHTML = `<div class="panel-error"><span>&#9888; Failed to load file</span><code>${escapeHtml(String(err))}</code></div>`;
            }
        }

        private renderMarkdown(md: string): string {
            // @ts-ignore
            const marked = window.marked;
            if (!marked) {
                // Fallback if marked is somehow not loaded
                return `<pre>${escapeHtml(md)}</pre>`;
            }

            // GFM is on by default in marked 4.x+
            // We still want to preserve our mermaid blocks to process them afterwards
            // Marked might try to escape or wrap them in <pre><code> so we might need a custom renderer
            // But let's see if we can just pre-process them.

            // Custom marker for mermaid so marked doesn't touch it
            const mermaidBlocks: string[] = [];
            let processedMd = md.replace(/```mermaid\n([\s\S]*?)```/g, (_m, code) => {
                const placeholder = `<!--MERMAID_${mermaidBlocks.length}-->`;
                mermaidBlocks.push(code.trim());
                return placeholder;
            });

            let html = marked.parse(processedMd);

            // Restore mermaid blocks
            mermaidBlocks.forEach((code, i) => {
                const placeholder = `&lt;!--MERMAID_${i}--&gt;`; // Marked will escape comments
                const realPlaceholder = `<!--MERMAID_${i}-->`;
                const replacement = `<div class="mermaid-block" data-mermaid="${escapeHtml(code)}"><div class="panel-loading"><div class="spinner"></div><span>Rendering diagram...</span></div></div>`;
                html = html.replace(placeholder, replacement).replace(realPlaceholder, replacement);
            });

            return html;
        }

        private async processMermaid(container: HTMLElement) {
            const blocks = container.querySelectorAll('.mermaid-block');
            if (blocks.length === 0) return;

            // @ts-ignore
            const mermaid = window.mermaid;
            if (!mermaid) return;

            for (let i = 0; i < blocks.length; i++) {
                const el = blocks[i] as HTMLElement;
                const code = el.dataset.mermaid || '';
                const id = `mermaid-svg-${Date.now()}-${i}`;
                try {
                    const { svg } = await mermaid.render(id, code);
                    el.innerHTML = `<div class="mermaid">${svg}</div>`;
                } catch (err) {
                    el.innerHTML = `<div class="panel-error" style="padding:10px;">Diagram error</div>`;
                }
            }
        }

        activateTab(id: string) {
            this.tabs.forEach(t => {
                t.tabEl.classList.remove('active');
                t.panelEl.style.display = 'none';
            });
            const target = this.tabs.get(id);
            if (!target) return;
            target.tabEl.classList.add('active');
            target.panelEl.style.display = 'flex';
            this.activeId = id;
            target.tabEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }

        closeTab(id: string) {
            const tab = this.tabs.get(id);
            if (!tab) return;
            const wasActive = this.activeId === id;
            const ids = Array.from(this.tabs.keys());
            const idx = ids.indexOf(id);
            tab.tabEl.remove();
            tab.panelEl.remove();
            this.tabs.delete(id);
            if (this.tabs.size === 0) {
                this.activeId = null;
                this.noFilesEl.style.display = 'flex';
                $('gui-welcome').style.display = 'flex';
                $('gui-project-view').style.display = 'none';
                return;
            }
            if (wasActive) { const nextId = ids[idx + 1] || ids[idx - 1]; if (nextId) this.activateTab(nextId); }
        }

        closeAll() {
            this.tabs.forEach(t => { t.tabEl.remove(); t.panelEl.remove(); });
            this.tabs.clear(); this.activeId = null;
            this.noFilesEl.style.display = 'flex';
            $('gui-welcome').style.display = 'flex';
            $('gui-project-view').style.display = 'none';
        }
    }

    // ─── Bootstrap ───────────────────────────────────────────────────────────
    let explorer: ExplorerTree | null = null;
    let reportTabManager: ReportTabManager | null = null;

    window.addEventListener('DOMContentLoaded', () => {
        // Initialize Mermaid
        // @ts-ignore
        if (window.mermaid) {
            // @ts-ignore
            window.mermaid.initialize({
                startOnLoad: false,
                theme: 'dark',
                securityLevel: 'loose',
                fontFamily: 'Inter, Segoe UI, sans-serif'
            });
        }

        explorer = new ExplorerTree($('gui-project-list'));
        reportTabManager = new ReportTabManager($('gui-report-tabs'), $('gui-panels'), $('gui-no-files'));

        $('gui-scan-btn')?.addEventListener('click', () => loadExplorer());
        $('gui-browse-btn')?.addEventListener('click', async () => {
            if (!bridge.gui?.browseFolder) return;
            const folder = await bridge.gui.browseFolder();
            if (folder) loadExplorer(folder);
        });

        loadExplorer();
    });

    async function loadExplorer(rootPath?: string) {
        const listEl = $('gui-project-list');
        const rootLabel = $('gui-scan-root-label');
        if (!listEl) return;

        listEl.innerHTML = `<div class="project-list-loading"><div class="spinner"></div><span>Loading explorer...</span></div>`;
        if (rootLabel) rootLabel.textContent = rootPath ? `Scoped to ${rootPath}` : 'Scanning all drives...';

        try {
            const projects: ProjectInfo[] = await bridge.gui.scanProjects(rootPath);
            explorer?.render(projects);
        } catch (err) {
            listEl.innerHTML = `<div class="project-list-error">Error: ${escapeHtml(String(err))}</div>`;
        }
    }

})(); // end IIFE
