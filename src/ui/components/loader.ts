import { LOADER_CSS } from '../styles/loader.css';

export function buildLoaderScript(): string {
    return `
(function () {
    const inject = () => {
        if (!document.head || !document.body) {
            setTimeout(inject, 10);
            return;
        }

        if (document.getElementById('atlas-loader-overlay')) return;
        if (sessionStorage.getItem('__atlas_booted__')) return;
        sessionStorage.setItem('__atlas_booted__', 'true');

        const style = document.createElement('style');
        style.id = 'atlas-loader-styles';
        style.textContent = \`${LOADER_CSS}\`;
        document.head.appendChild(style);

        const el = document.createElement('div');
        el.id = 'atlas-loader-overlay';
        el.innerHTML = '<div class="atlas-core">' +
            '<div class="atlas-ring"></div>' +
            '<div class="atlas-pulse"></div>' +
            '<div class="atlas-text">ATLAS</div>' +
            '<div class="atlas-status">INITIALIZING SYSTEM...</div>' +
            '</div>';
        
        document.body.appendChild(el);

        let progress = 0;
        const totalDuration = 3000; // 3 seconds
        const stepTime = 50; 
        const totalSteps = totalDuration / stepTime;
        const progressIncrement = 100 / totalSteps;

        const interval = setInterval(() => {
            progress += progressIncrement + (Math.random() * 2); // Slightly unpredictable for "real" feel
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                setTimeout(() => {
                    el.style.opacity = '0';
                    setTimeout(() => {
                        if (el.parentNode) el.remove();
                    }, 800);
                }, 400);
            }
        }, stepTime);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject);
    } else {
        inject();
    }
})();
`;
}

export const LOADER = buildLoaderScript();
