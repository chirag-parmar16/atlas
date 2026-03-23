import { z } from 'zod';

/**
 * Schema for Security Mode
 */
export const securityModeSchema = z.enum(['Standard', 'Strict', 'Offline']);

/**
 * Schema for Chaos/Stress Configuration
 */
export const stressConfigSchema = z.object({
    enabled: z.boolean(),
    errorRate: z.number().min(0).max(100),
    latencyRate: z.number().min(0).max(100),
    dropRate: z.number().min(0).max(100)
});

/**
 * Schema for HTTP Headers
 * Allows a record of strings/string arrays, but can be used to restrict known malicious patterns.
 */
export const headersSchema = z.record(z.string(), z.union([z.string(), z.array(z.string())]));

/**
 * Schema for Query Parameters
 */
export const queryParamsSchema = z.record(z.string(), z.string().max(2048));

/**
 * IPC Payload Schemas (Moved from electron-main.ts logic)
 */
export const saveVideoChunkSchema = z.object({
    sessionId: z.string(),
    buffer: z.instanceof(ArrayBuffer)
});

export const finalizeVideoSchema = z.object({
    sessionId: z.string()
});
