import { Violation, NetworkRequest, ChaosConfig } from '../engine/state';

/**
 * Type guard for NetworkRequest
 */
export function isNetworkRequest(obj: unknown): obj is NetworkRequest {
    if (typeof obj !== 'object' || obj === null) return false;
    const req = obj as NetworkRequest;
    return (
        typeof req.id === 'string' &&
        typeof req.url === 'string' &&
        typeof req.method === 'string' &&
        typeof req.status === 'number'
    );
}

/**
 * Type guard for Violation
 */
export function isViolation(obj: unknown): obj is Violation {
    if (typeof obj !== 'object' || obj === null) return false;
    const v = obj as Violation;
    return (
        typeof v.source === 'string' &&
        typeof v.message === 'string' &&
        typeof v.timestamp === 'number' &&
        typeof v.url === 'string'
    );
}

/**
 * Type guard for ChaosConfig
 */
export function isChaosConfig(obj: unknown): obj is ChaosConfig {
    if (typeof obj !== 'object' || obj === null) return false;
    const c = obj as ChaosConfig;
    return (
        typeof c.enabled === 'boolean' &&
        typeof c.errorRate === 'number' &&
        typeof c.latencyRate === 'number' &&
        typeof c.dropRate === 'number'
    );
}

/**
 * Type guard for a record/object
 */
export function isRecord(obj: unknown): obj is Record<string, unknown> {
    return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}
