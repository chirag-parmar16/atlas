import readline from 'readline';

export class Dashboard {
    private startTime: number;
    private requestCount: number = 0;
    private chaosEvents: number = 0;
    private config: { domain: string, port: number } = { domain: '...', port: 0 };

    // ANSI Colors
    private C = {
        RESET: "\x1b[0m",
        GREEN: "\x1b[32m",
        CYAN: "\x1b[36m",
        YELLOW: "\x1b[33m",
        DIM: "\x1b[2m",
        BOLD: "\x1b[1m",
        RED: "\x1b[31m",
    };

    constructor() {
        this.startTime = Date.now();
    }

    public init(domain: string, port: number) {
        this.config = { domain, port };
        this.printHeader();
    }

    private printHeader() {
        console.log(''); // Spacing buffer
        console.log(`${this.C.DIM}====================================================${this.C.RESET}`);
        console.log(`${this.C.BOLD}STATUS :${this.C.RESET} ${this.C.GREEN}ONLINE (MASKING ACTIVE)${this.C.RESET}`);
        console.log(`${this.C.BOLD}TARGET :${this.C.RESET} ${this.C.YELLOW}${this.config.domain}${this.C.RESET} -> ${this.C.CYAN}localhost:${this.config.port}${this.C.RESET}`);
        console.log(`${this.C.DIM}====================================================${this.C.RESET}`);
        console.log(`${this.C.BOLD}LIVE LOGS:${this.C.RESET}`);
    }

    public logRequest() {
        this.requestCount++;
    }

    public logChaos() {
        this.chaosEvents++;
    }

    public addLog(msg: string) {
        // Clean ANSI for cleaner log file output if needed, but keep for terminal
        // Just print immediately
        // Add a small timestamp prefix for clarity
        const time = new Date().toLocaleTimeString();
        console.log(`   ${this.C.DIM}${time} >${this.C.RESET} ${msg}`);
    }

    public stop() {
        console.log(`${this.C.DIM}====================================================${this.C.RESET}`);
        console.log(`${this.C.YELLOW}Session Ended.${this.C.RESET}`);
    }
}

export const dashboard = new Dashboard();
