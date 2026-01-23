import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { WSMessage, InterceptedRequest } from './types.js';
import chalk from 'chalk';

export interface WiretapWebSocketServerOptions {
  port?: number;
  server?: Server;
}

export class WiretapWebSocketServer {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private requests: Map<string, InterceptedRequest> = new Map();

  constructor(options: WiretapWebSocketServerOptions = {}) {
    if (options.server) {
      this.wss = new WebSocketServer({ server: options.server });
    } else {
      this.wss = new WebSocketServer({ port: options.port || 8081 });
    }

    this.wss.on('connection', (ws, req) => {
      const clientIp = req.socket.remoteAddress || 'unknown';
      console.log(chalk.blue('⬤'), `UI client connected from ${clientIp}`);
      this.clients.add(ws);

      // Send current state to new client
      this.sendCurrentState(ws);

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'clear_all') {
            console.log(chalk.yellow('⟲'), 'Clearing all requests');
            this.requests.clear();
            this.broadcast({ type: 'clear_all' });
          }
        } catch (error) {
          console.error(chalk.red('✗'), `Failed to parse client message: ${error}`);
        }
      });

      ws.on('close', () => {
        console.log(chalk.gray('○'), `UI client disconnected from ${clientIp}`);
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error(chalk.red('✗'), `WebSocket error: ${error.message}`);
        this.clients.delete(ws);
      });
    });

    this.wss.on('error', (error) => {
      console.error(chalk.red('✗'), `WebSocket server error: ${error.message}`);
    });
  }

  private sendCurrentState(ws: WebSocket): void {
    // Send all existing requests to the newly connected client
    for (const request of this.requests.values()) {
      this.sendToClient(ws, {
        type: 'request_start',
        requestId: request.id,
        timestamp: request.timestamp,
        method: request.method,
        url: request.url,
        headers: request.requestHeaders,
      });

      if (request.requestBody) {
        this.sendToClient(ws, {
          type: 'request_body',
          requestId: request.id,
          body: request.requestBody,
        });
      }

      if (request.statusCode !== undefined) {
        this.sendToClient(ws, {
          type: 'response_start',
          requestId: request.id,
          timestamp: request.responseStartTime || request.timestamp,
          statusCode: request.statusCode,
          headers: request.responseHeaders || {},
        });
      }

      // Send SSE events
      for (const event of request.sseEvents) {
        this.sendToClient(ws, {
          type: 'response_chunk',
          requestId: request.id,
          event,
        });
      }

      if (request.response) {
        this.sendToClient(ws, {
          type: 'response_complete',
          requestId: request.id,
          timestamp: Date.now(),
          response: request.response,
          durationMs: request.durationMs || 0,
        });
      }
    }
  }

  private sendToClient(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  broadcast(message: WSMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  // Request management

  addRequest(request: InterceptedRequest): void {
    this.requests.set(request.id, request);
  }

  getRequest(requestId: string): InterceptedRequest | undefined {
    return this.requests.get(requestId);
  }

  // Stats

  getClientCount(): number {
    return this.clients.size;
  }

  getRequestCount(): number {
    return this.requests.size;
  }

  // Lifecycle

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      for (const client of this.clients) {
        client.close();
      }
      this.clients.clear();

      this.wss.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  getPort(): number | undefined {
    const address = this.wss.address();
    if (address && typeof address === 'object') {
      return address.port;
    }
    return undefined;
  }
}
