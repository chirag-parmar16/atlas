import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';

export async function init() {
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

    // Prompt for Target Domain
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'targetDomain',
            message: 'Enter target domain to mask (e.g., example.com):',
            validate: (input) => input.trim().length > 0 || 'Domain cannot be empty'
        }
    ]);

    // Create config based on type
    const config = {
        projectType: projectType,
        targetDomain: answers.targetDomain,
        startupTimeout: 30000,
        recordingEnabled: true,
        debugMode: false,
        // Add specific presets if needed
        ...(projectType === 'laravel' ? { phpServer: true } : {}),
        ...(projectType === 'nextjs' ? { nextLinkOptimization: true } : {})
    };

    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
        console.log('\n\x1b[32m✓ Successfully initialized Atlas!\x1b[0m');
        console.log(`\nCreated: \x1b[36m${configPath}\x1b[0m`);
        console.log('\nConfiguration:');
        console.log(`  • Type: ${projectType}`);
        console.log(`  • Domain: ${answers.targetDomain}`);
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
        if (composer.require && composer.require['laravel/framework']) return 'laravel';
        return 'php';
    }

    if (fs.existsSync(path.join(cwd, 'package.json'))) {
        const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (deps['next']) return 'nextjs';
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
