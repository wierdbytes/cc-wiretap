import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { WSMessage, Session, InterceptedRequest } from './types.js';
import chalk from 'chalk';

export interface WiretapWebSocketServerOptions {
  port?: number;
  server?: Server;
}

export class WiretapWebSocketServer {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private sessions: Map<string, Session> = new Map();

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
    // Send all existing sessions and requests to the newly connected client
    for (const session of this.sessions.values()) {
      this.sendToClient(ws, {
        type: 'session_start',
        sessionId: session.id,
        timestamp: session.startTime,
      });

      for (const request of session.requests) {
        this.sendToClient(ws, {
          type: 'request_start',
          sessionId: session.id,
          requestId: request.id,
          timestamp: request.timestamp,
          method: request.method,
          url: request.url,
          headers: request.requestHeaders,
        });

        if (request.requestBody) {
          this.sendToClient(ws, {
            type: 'request_body',
            sessionId: session.id,
            requestId: request.id,
            body: request.requestBody,
          });
        }

        if (request.statusCode !== undefined) {
          this.sendToClient(ws, {
            type: 'response_start',
            sessionId: session.id,
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
            sessionId: session.id,
            requestId: request.id,
            event,
          });
        }

        if (request.response) {
          this.sendToClient(ws, {
            type: 'response_complete',
            sessionId: session.id,
            requestId: request.id,
            timestamp: Date.now(),
            response: request.response,
            durationMs: request.durationMs || 0,
          });
        }
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

  // Session management

  createSession(sessionId: string): Session {
    const session: Session = {
      id: sessionId,
      startTime: Date.now(),
      requests: [],
    };
    this.sessions.set(sessionId, session);

    this.broadcast({
      type: 'session_start',
      sessionId,
      timestamp: session.startTime,
    });

    return session;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  getOrCreateSession(sessionId: string): Session {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = this.createSession(sessionId);
    }
    return session;
  }

  addRequest(sessionId: string, request: InterceptedRequest): void {
    const session = this.getOrCreateSession(sessionId);
    session.requests.push(request);
  }

  getRequest(sessionId: string, requestId: string): InterceptedRequest | undefined {
    const session = this.sessions.get(sessionId);
    return session?.requests.find((r) => r.id === requestId);
  }

  // Stats

  getClientCount(): number {
    return this.clients.size;
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  getTotalRequestCount(): number {
    let count = 0;
    for (const session of this.sessions.values()) {
      count += session.requests.length;
    }
    return count;
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
