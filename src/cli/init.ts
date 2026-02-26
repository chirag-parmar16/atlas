import fs from 'fs';
import path from 'path';

async function readConsole(promptText: string): Promise<string> {
    return new Promise<string>((resolve) => {
        process.stdout.write(promptText);

        // Use generic readline for normal environments
        if (process.stdin.isTTY) {
            const rl = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });
            rl.question('', (answer: string) => {
                rl.close();
                resolve(answer.trim());
            });
            return;
        }

        // Fallback for packaged Electron Windows apps where stdin/stdout is detached
        try {
            const fd = fs.openSync('\\\\.\\CON', 'rs');
            const buf = Buffer.alloc(512);
            const bytesRead = fs.readSync(fd, buf, 0, 512, null);
            fs.closeSync(fd);
            resolve(buf.toString('utf8', 0, bytesRead).trim());
        } catch (e) {
            // Absolute worst-case fallback, though CON should always work on Windows
            console.error('\n\x1b[31m[Error] Cannot read from console. Please run this command from a standard terminal.\x1b[0m');
            process.exit(1);
        }
    });
}
import readline from 'readline';

export async function init(providedDomain?: string) {
    const projectPath = process.cwd();
    const configPath = path.join(projectPath, 'atlas.config.json');

    // Check if config already exists
    if (fs.existsSync(configPath)) {
        console.log('\n\x1b[33m[Atlas] atlas.config.json already exists in this directory.\x1b[0m');
        console.log('If you want to reset it, delete the existing file and run init again.\n');
        return;
    }

    // Detect Project Type
    const projectType = detectProjectType(projectPath);
    console.log(`[Atlas] Detected Project Type: \x1b[36m${projectType}\x1b[0m`);

    let targetDomain = providedDomain?.trim();

    if (!targetDomain) {
        let isValid = false;
        while (!isValid) {
            targetDomain = await readConsole('Enter target domain to mask (e.g., example.com): ');
            if (targetDomain.length > 0) {
                isValid = true;
            } else {
                console.log('\x1b[31mDomain cannot be empty\x1b[0m');
            }
        }
    }

    // Create config based on type
    const config = {
        projectType: projectType,
        targetDomain: targetDomain,
        startupTimeout: 30000,
        recordingEnabled: true,
        debugMode: false
    };

    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
        console.log('\n\x1b[32m✓ Successfully initialized Atlas!\x1b[0m');
        console.log(`\nCreated: \x1b[36m${configPath}\x1b[0m`);
        console.log('\nConfiguration:');
        console.log(`  • Type: ${projectType}`);
        console.log(`  • Domain: ${targetDomain}`);
        console.log('  • Startup timeout: 30 seconds');
        console.log('  • Recording: Enabled');
        console.log('  • Debug mode: Disabled');
        console.log('\nYou can now run: \x1b[36matlas run\x1b[0m\n');
    } catch (error) {
        console.error('\n\x1b[31m[Error] Failed to create atlas.config.json:\x1b[0m', (error as Error).message);
        process.exit(1);
    }
}

function detectProjectType(cwd: string): string {
    if (fs.existsSync(path.join(cwd, 'composer.json'))) {
        const composer = JSON.parse(fs.readFileSync(path.join(cwd, 'composer.json'), 'utf-8'));
        if (composer.require && composer.require['laravel/framework']) return 'php'; // Laravel detected, using PHP preset
        return 'php';
    }

    if (fs.existsSync(path.join(cwd, 'package.json'))) {
        const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (deps['next']) return 'node'; // Next.js detected, using Node preset
        if (deps['react']) return 'react';
        if (deps['vue']) return 'vue';
        if (deps['@angular/core']) return 'angular';
        if (deps['express']) return 'node-express';

        return 'node';
    }

    if (fs.existsSync(path.join(cwd, 'index.html'))) return 'static';
    if (fs.existsSync(path.join(cwd, 'index.php'))) return 'php';

    return 'unknown';
}
