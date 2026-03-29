import fs from 'fs';
import path from 'path';
import os from 'os';

export interface AtlasConfig {
    geminiApiKey?: string;
    aiEnabled: boolean;
}

export class ConfigManager {
    private configDir: string;
    private configPath: string;

    constructor() {
        // Use standard AppData/Home directory based on OS
        const homeDir = os.homedir();
        if (process.platform === 'win32') {
            this.configDir = path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'Atlas');
        } else if (process.platform === 'darwin') {
            this.configDir = path.join(homeDir, 'Library', 'Application Support', 'Atlas');
        } else {
            this.configDir = path.join(homeDir, '.config', 'atlas');
        }

        this.configPath = path.join(this.configDir, 'atlas-config.json');
        this.ensureConfigDir();
    }

    private ensureConfigDir() {
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
        }
    }

    public getConfig(): AtlasConfig {
        try {
            if (!fs.existsSync(this.configPath)) {
                return { aiEnabled: false };
            }
            const content = fs.readFileSync(this.configPath, 'utf-8');
            return JSON.parse(content);
        } catch (e) {
            console.error('[Atlas] Failed to read config:', e);
            return { aiEnabled: false };
        }
    }

    public saveConfig(config: Partial<AtlasConfig>) {
        try {
            const current = this.getConfig();
            const updated = { ...current, ...config };
            fs.writeFileSync(this.configPath, JSON.stringify(updated, null, 2), 'utf-8');
            return true;
        } catch (e) {
            console.error('[Atlas] Failed to save config:', e);
            return false;
        }
    }

    public getApiKey(): string | undefined {
        return this.getConfig().geminiApiKey;
    }

    public isAiEnabled(): boolean {
        return this.getConfig().aiEnabled && !!this.getApiKey();
    }
}

export const globalConfig = new ConfigManager();
