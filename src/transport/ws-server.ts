/**
 * Atlas Transport — WebSocket Server
 * 
 * Broadcasts Engine state to connected Renderer clients.
 * Receives actions from Renderer and routes to Dispatcher.
 * Handles reconnection gracefully.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { ServerMessage, ClientMessage, parseClientMessage, PROTOCOL_VERSION } from './protocol';
import { AtlasState } from '../engine/state';

export interface WSServerCallbacks {
    onClientMessage: (msg: ClientMessage) => void;
    getState: () => AtlasState;
}

export class AtlasWSServer {
    private wss: WebSocketServer | null = null;
    private clients: Set<WebSocket> = new Set();
    private port: number = 0;
    private callbacks: WSServerCallbacks;

    constructor(callbacks: WSServerCallbacks) {
        this.callbacks = callbacks;
    }

    /**
     * Start WebSocket server on a random available port.
     */
    async start(): Promise<number> {
        return new Promise((resolve) => {
            this.wss = new WebSocketServer({ port: 0 });

            this.wss.on('listening', () => {
                this.port = (this.wss!.address() as any).port;
                console.log(`[Atlas] Transport WS Server listening on port ${this.port}`);
                resolve(this.port);
            });

            this.wss.on('connection', (ws) => {
                this.clients.add(ws);
                console.log(`[Atlas] Renderer connected (${this.clients.size} client(s))`);

                // Send full state on connect
                this.send(ws, {
                    type: 'STATE_SYNC',
                    version: PROTOCOL_VERSION,
                    payload: this.callbacks.getState()
                });

                ws.on('message', (raw) => {
                    const msg = parseClientMessage(raw.toString());
                    if (msg) {
                        this.callbacks.onClientMessage(msg);
                    }
                });

                ws.on('close', () => {
                    this.clients.delete(ws);
                    console.log(`[Atlas] Renderer disconnected (${this.clients.size} client(s))`);
                });

                ws.on('error', () => {
                    this.clients.delete(ws);
                });
            });
        });
    }

    /**
     * Broadcast a message to all connected Renderer clients.
     */
    broadcast(message: ServerMessage): void {
        const data = JSON.stringify(message);
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        }
    }

    /**
     * Send a message to a specific client.
     */
    private send(ws: WebSocket, message: ServerMessage): void {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    /**
     * Get the port the server is listening on.
     */
    getPort(): number {
        return this.port;
    }

    /**
     * Get count of connected clients.
     */
    getClientCount(): number {
        return this.clients.size;
    }

    /**
     * Shut down the server and disconnect all clients.
     */
    async close(): Promise<void> {
        for (const client of this.clients) {
            try { client.close(); } catch (e) { }
        }
        this.clients.clear();

        if (this.wss) {
            return new Promise((resolve) => {
                this.wss!.close(() => resolve());
            });
        }
    }
}
