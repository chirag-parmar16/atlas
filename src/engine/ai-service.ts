import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { Violation } from './state';
import { globalConfig } from './config-manager';

export interface AiInsight {
    summary: string;
    actionItems: string[];
    falsyViolations: string[]; // List of violation IDs or messages that are false positives
}

export class AiService {
    private genAI: GoogleGenerativeAI | null = null;
    private model: GenerativeModel | null = null;

    constructor() {
        this.reinitialize();
    }

    public reinitialize() {
        const apiKey = globalConfig.getApiKey();
        if (apiKey) {
            try {
                this.genAI = new GoogleGenerativeAI(apiKey);
                this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            } catch (e) {
                console.error('[Atlas:AI] Failed to init Gemini:', e);
            }
        }
    }

    /**
     * Group a list of violations into an executive summary.
     */
    public async generateExecutiveSummary(violations: Violation[]): Promise<string> {
        if (!this.model) return 'AI Summary is unavailable (Config required).';

        const context = violations.slice(0, 15).map(v => ({
            source: v.source,
            message: v.message,
            url: v.url
        }));

        const prompt = `
            Analyze these ${violations.length} application violations found during an Atlas session:
            ${JSON.stringify(context, null, 2)}
            
            Provide a professional executive summary (max 100 words) identifying major patterns and 3 prioritized technical fixes.
            Use Markdown formatting.
        `;

        try {
            const result = await this.model.generateContent(prompt);
            return result.response.text().trim();
        } catch (e) {
            console.error('[Atlas AI] Summary failed:', e);
            return 'Failed to generate AI executive summary.';
        }
    }

    /**
     * Provide a real-time explanation for a specific error.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public async explainError(message: string, context?: any): Promise<string | null> {
        if (!this.model) return null;

        const urlInfo = context?.url || context?.timestamp || '';
        const prompt = `
            Briefly explain why this error happened in a Sandbox environment (localhost masked to a domain):
            Error: ${message}
            Context: ${JSON.stringify(context)}
            
            Max 25 words. Be direct.
        `;

        try {
            const result = await this.model.generateContent(prompt);
            return result.response.text().trim();
        } catch (e) {
            return null;
        }
    }

    /**
     * Test the AI connection to verify API key.
     */
    public async testConnection(): Promise<boolean> {
        if (!this.model) return false;
        try {
            const result = await this.model.generateContent("Hello. Respond with OK.");
            return result.response.text().includes("OK");
        } catch (e) {
            console.error('[Atlas AI] Connection test failed:', e);
            return false;
        }
    }
}

export const aiService = new AiService();
