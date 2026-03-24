const fs = require('fs');
const path = require('path');

function copyFile(src, dest) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    // If destination is a directory, append src filename
    if (fs.existsSync(dest) && fs.statSync(dest).isDirectory()) {
        dest = path.join(dest, path.basename(src));
    }
    fs.copyFileSync(src, dest);
    console.log(`Copied ${src} -> ${dest}`);
}

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    let entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        let srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            copyFile(srcPath, destPath);
        }
    }
}

try {
    copyDir('src/electron/assets', 'dist/src/electron/assets');
    copyFile('dist/src/electron/preload.js', 'dist/electron/preload.js');
    copyFile('dist/src/gui/gui-renderer.js', 'dist/gui/gui-renderer.js');
    copyFile('src/gui/gui.css', 'dist/gui/gui.css');
    copyFile('src/gui/gui-host.html', 'dist/gui/gui-host.html');
    copyFile('src/electron/assets/icon.png', 'dist/gui/icon.png');
    copyFile('node_modules/mermaid/dist/mermaid.min.js', 'dist/gui/mermaid.min.js');
    copyFile('node_modules/marked/marked.min.js', 'dist/gui/marked.min.js');
    console.log("✅ Cross-platform asset copy complete!");
} catch (e) {
    console.error("❌ Error copying assets:", e.message);
    process.exit(1);
}
