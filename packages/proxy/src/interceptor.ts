import type { CompletedRequest } from 'mockttp';
import { randomUUID } from 'crypto';
import chalk from 'chalk';
import type {
  ClaudeRequest,
  ClaudeResponse,
  InterceptedRequest,
} from './types.js';
import { SSEStreamParser, reconstructResponseFromEvents } from './parser.js';
import type { WiretapWebSocketServer } from './websocket.js';

const CLAUDE_API_HOSTS = [
  'api.anthropic.com',
  'api.claude.ai',
];

const CLAUDE_MESSAGES_PATH = '/v1/messages';

export class ClaudeInterceptor {
  private wsServer: WiretapWebSocketServer;
  private activeRequests: Map<string, {
    request: InterceptedRequest;
    parser: SSEStreamParser;
    sessionId: string;
  }> = new Map();

  constructor(wsServer: WiretapWebSocketServer) {
    this.wsServer = wsServer;
  }

  isClaudeRequest(request: CompletedRequest): boolean {
    const host = request.headers.host || new URL(request.url).host;
    const path = new URL(request.url).pathname;

    return (
      CLAUDE_API_HOSTS.some((h) => host.includes(h)) &&
      path.includes(CLAUDE_MESSAGES_PATH) &&
      request.method === 'POST'
    );
  }

  async handleRequest(request: CompletedRequest): Promise<string | null> {
    if (!this.isClaudeRequest(request)) {
      return null;
    }

    const requestId = randomUUID();
    const sessionId = this.extractSessionId(request) || 'default';
    const timestamp = Date.now();

    // Parse request body
    let requestBody: ClaudeRequest | undefined;
    try {
      const bodyBuffer = request.body.buffer;
      if (bodyBuffer.length > 0) {
        const bodyText = bodyBuffer.toString('utf-8');
        requestBody = JSON.parse(bodyText) as ClaudeRequest;
      }
    } catch (error) {
      console.error(chalk.yellow('⚠'), 'Failed to parse request body:', error);
    }

    // Create intercepted request
    const intercepted: InterceptedRequest = {
      id: requestId,
      sessionId,
      timestamp,
      method: request.method,
      url: request.url,
      requestHeaders: this.headersToRecord(request.headers),
      requestBody,
      sseEvents: [],
    };

    // Store active request
    this.activeRequests.set(requestId, {
      request: intercepted,
      parser: new SSEStreamParser(),
      sessionId,
    });

    // Add to session and broadcast
    this.wsServer.addRequest(sessionId, intercepted);

    this.wsServer.broadcast({
      type: 'request_start',
      sessionId,
      requestId,
      timestamp,
      method: request.method,
      url: request.url,
      headers: intercepted.requestHeaders,
    });

    if (requestBody) {
      this.wsServer.broadcast({
        type: 'request_body',
        sessionId,
        requestId,
        body: requestBody,
      });

      // Log request info
      const model = requestBody.model || 'unknown';
      const messageCount = requestBody.messages?.length || 0;
      const hasTools = requestBody.tools && requestBody.tools.length > 0;
      const isStreaming = requestBody.stream === true;

      console.log(
        chalk.cyan('→'),
        chalk.white(`[${sessionId.slice(0, 8)}]`),
        chalk.green(model),
        `${messageCount} messages`,
        hasTools ? chalk.yellow(`+ ${requestBody.tools!.length} tools`) : '',
        isStreaming ? chalk.magenta('streaming') : ''
      );
    }

    return requestId;
  }

  async handleResponseStart(
    requestId: string,
    statusCode: number,
    headers: Record<string, string>
  ): Promise<void> {
    const active = this.activeRequests.get(requestId);
    if (!active) {
      return;
    }

    const timestamp = Date.now();
    active.request.responseStartTime = timestamp;
    active.request.statusCode = statusCode;
    active.request.responseHeaders = headers;

    this.wsServer.broadcast({
      type: 'response_start',
      sessionId: active.sessionId,
      requestId,
      timestamp,
      statusCode,
      headers,
    });
  }

  handleResponseChunk(requestId: string, chunk: Buffer | string): void {
    const active = this.activeRequests.get(requestId);
    if (!active) {
      return;
    }

    const data = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
    const events = active.parser.feed(data);

    for (const event of events) {
      active.request.sseEvents.push(event);
      this.wsServer.broadcast({
        type: 'response_chunk',
        sessionId: active.sessionId,
        requestId,
        event,
      });

      // Log streaming progress for text deltas
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        process.stdout.write(chalk.gray('.'));
      }
    }
  }

  async handleResponseComplete(requestId: string): Promise<void> {
    const active = this.activeRequests.get(requestId);
    if (!active) {
      return;
    }

    // Flush any remaining data
    const remainingEvents = active.parser.flush();
    for (const event of remainingEvents) {
      active.request.sseEvents.push(event);
      this.wsServer.broadcast({
        type: 'response_chunk',
        sessionId: active.sessionId,
        requestId,
        event,
      });
    }

    // Reconstruct full response
    const response = reconstructResponseFromEvents(active.request.sseEvents);
    const timestamp = Date.now();
    const durationMs = timestamp - active.request.timestamp;

    active.request.response = response || undefined;
    active.request.durationMs = durationMs;

    if (response) {
      this.wsServer.broadcast({
        type: 'response_complete',
        sessionId: active.sessionId,
        requestId,
        timestamp,
        response,
        durationMs,
      });

      // Log completion
      console.log(); // New line after streaming dots
      console.log(
        chalk.green('✓'),
        chalk.white(`[${active.sessionId.slice(0, 8)}]`),
        `${response.usage.input_tokens} in / ${response.usage.output_tokens} out`,
        chalk.gray(`(${durationMs}ms)`),
        response.stop_reason === 'tool_use' ? chalk.yellow('→ tool_use') : ''
      );
    }

    // Cleanup
    this.activeRequests.delete(requestId);
  }

  handleResponseError(requestId: string, error: Error): void {
    const active = this.activeRequests.get(requestId);
    if (!active) {
      return;
    }

    active.request.error = error.message;

    this.wsServer.broadcast({
      type: 'error',
      sessionId: active.sessionId,
      requestId,
      error: error.message,
      timestamp: Date.now(),
    });

    console.log(
      chalk.red('✗'),
      chalk.white(`[${active.sessionId.slice(0, 8)}]`),
      error.message
    );

    this.activeRequests.delete(requestId);
  }

  handleNonStreamingResponse(
    requestId: string,
    _statusCode: number,
    bodyText: string
  ): void {
    const active = this.activeRequests.get(requestId);
    if (!active) {
      return;
    }

    try {
      if (bodyText) {
        const claudeResponse = JSON.parse(bodyText) as ClaudeResponse;
        const timestamp = Date.now();
        const durationMs = timestamp - active.request.timestamp;

        active.request.response = claudeResponse;
        active.request.durationMs = durationMs;

        this.wsServer.broadcast({
          type: 'response_complete',
          sessionId: active.sessionId,
          requestId,
          timestamp,
          response: claudeResponse,
          durationMs,
        });

        if (claudeResponse.type === 'message') {
          console.log(
            chalk.green('✓'),
            chalk.white(`[${active.sessionId.slice(0, 8)}]`),
            `${claudeResponse.usage.input_tokens} in / ${claudeResponse.usage.output_tokens} out`,
            chalk.gray(`(${durationMs}ms)`),
            claudeResponse.stop_reason === 'tool_use' ? chalk.yellow('→ tool_use') : ''
          );
        } else if (claudeResponse.type === 'error') {
          console.log(
            chalk.yellow('⚠'),
            chalk.white(`[${active.sessionId.slice(0, 8)}]`),
            chalk.red(claudeResponse.error.message),
            chalk.gray(`(${durationMs}ms)`)
          );
        }
      }
    } catch (error) {
      console.error(chalk.yellow('⚠'), 'Failed to parse response body:', error);
    }

    this.activeRequests.delete(requestId);
  }

  private extractSessionId(request: CompletedRequest): string {
    // Try to extract session ID from headers or generate one
    const headers = request.headers;

    // Check common session header patterns
    const sessionHeader =
      headers['x-session-id'] ||
      headers['x-request-id'] ||
      headers['x-correlation-id'];

    if (sessionHeader) {
      return Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader;
    }

    // Use a hash of certain request properties for consistent session grouping
    return randomUUID();
  }

  private headersToRecord(headers: Record<string, string | string[] | undefined>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (value !== undefined) {
        result[key] = Array.isArray(value) ? value.join(', ') : value;
      }
    }
    return result;
  }

  getActiveRequestCount(): number {
    return this.activeRequests.size;
  }
}
