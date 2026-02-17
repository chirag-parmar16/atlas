
export const CLOSER = `
(() => {
    if (document.getElementById('atlas-closer-overlay')) return;

    const style = document.createElement('style');
    style.textContent = \`
        #atlas-closer-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: #000;
            z-index: 2147483647; /* Max z-index */
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-family: 'Inter', sans-serif;
            color: #fff;
            opacity: 0;
            transition: opacity 0.3s ease-in;
        }

        .atlas-closer-circle {
            width: 60px;
            height: 60px;
            border: 3px solid rgba(57, 255, 20, 0.1);
            border-top: 3px solid #39ff14; /* Neon Green */
            border-radius: 50%;
            animation: atlas-spin 1s linear infinite;
            margin-bottom: 20px;
            box-shadow: 0 0 15px rgba(57, 255, 20, 0.2);
        }

        .atlas-closer-title {
            font-size: 20px;
            font-weight: 700;
            letter-spacing: 2px;
            color: #39ff14;
            text-shadow: 0 0 10px rgba(57, 255, 20, 0.5);
            margin-bottom: 10px;
        }

        .atlas-closer-msg {
            font-size: 14px;
            color: #ccc;
            margin-top: 5px;
        }
        
        .atlas-report-path {
            font-family: monospace;
            background: #111;
            padding: 5px 10px;
            border-radius: 4px;
            color: #00f0ff;
            margin-top: 15px;
            border: 1px solid #333;
        }

        @keyframes atlas-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    \`;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'atlas-closer-overlay';
    overlay.innerHTML = \`
        <div class="atlas-closer-circle"></div>
        <div class="atlas-closer-title">SHUTTING DOWN</div>
        <div class="atlas-closer-msg">Generating final session report...</div>
        <div class="atlas-closer-msg">Your report is generated in project folder</div>
    \`;
    document.documentElement.appendChild(overlay);

    // Fade in
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
    });
})();
`;
