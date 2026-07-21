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

// Legacy: kept only for backwards-compatible exports. Interception is no longer
// host-based — see isAnthropicMessagesRequest() below.
export const CLAUDE_API_HOSTS = [
  'api.anthropic.com',
  'api.claude.ai',
];

const CLAUDE_MESSAGES_PATH = '/v1/messages';

/**
 * Host-agnostic protocol detection: does this request body conform to the
 * Anthropic Messages API request shape? This lets the wiretap capture traffic
 * from any Anthropic-compatible endpoint (api.anthropic.com, Qwen Cloud
 * /apps/anthropic, gateways, proxies, ...) rather than a fixed hostname list.
 */
function isAnthropicMessagesBody(buffer: Buffer | undefined): boolean {
  if (!buffer || buffer.length === 0) return false;
  try {
    const body = JSON.parse(buffer.toString('utf-8')) as Record<string, unknown>;
    if (body === null || typeof body !== 'object') return false;
    // Required by the Anthropic Messages protocol.
    if (typeof body.model !== 'string') return false;
    if (!Array.isArray(body.messages)) return false;
    // max_tokens is required by the protocol; allow absent but reject wrong type.
    if (body.max_tokens !== undefined && typeof body.max_tokens !== 'number') return false;
    return true;
  } catch {
    return false;
  }
}

export class ClaudeInterceptor {
  private wsServer: WiretapWebSocketServer;
  private activeRequests: Map<string, {
    request: InterceptedRequest;
    parser: SSEStreamParser;
  }> = new Map();

  constructor(wsServer: WiretapWebSocketServer) {
    this.wsServer = wsServer;
  }

  isClaudeRequest(request: CompletedRequest): boolean {
    // Match by protocol conformance, not hostname:
    //   - POST to a path ending in /v1/messages (Anthropic Messages endpoint)
    //   - body shaped like an Anthropic Messages request
    if (request.method !== 'POST') return false;

    let path: string;
    try {
      path = new URL(request.url).pathname;
    } catch {
      return false;
    }
    if (!path.includes(CLAUDE_MESSAGES_PATH)) return false;

    return isAnthropicMessagesBody(request.body.buffer);
  }

  async handleRequest(request: CompletedRequest): Promise<string | null> {
    if (!this.isClaudeRequest(request)) {
      return null;
    }

    const requestId = randomUUID();
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
    });

    // Add to store and broadcast
    this.wsServer.addRequest(intercepted);

    this.wsServer.broadcast({
      type: 'request_start',
      requestId,
      timestamp,
      method: request.method,
      url: request.url,
      headers: intercepted.requestHeaders,
    });

    if (requestBody) {
      this.wsServer.broadcast({
        type: 'request_body',
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
        chalk.white(`[${requestId.slice(0, 8)}]`),
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
        requestId,
        timestamp,
        response,
        durationMs,
      });

      // Log completion
      console.log(); // New line after streaming dots
      console.log(
        chalk.green('✓'),
        chalk.white(`[${requestId.slice(0, 8)}]`),
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
      requestId,
      error: error.message,
      timestamp: Date.now(),
    });

    console.log(
      chalk.red('✗'),
      chalk.white(`[${requestId.slice(0, 8)}]`),
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
          requestId,
          timestamp,
          response: claudeResponse,
          durationMs,
        });

        if (claudeResponse.type === 'message') {
          console.log(
            chalk.green('✓'),
            chalk.white(`[${requestId.slice(0, 8)}]`),
            `${claudeResponse.usage.input_tokens} in / ${claudeResponse.usage.output_tokens} out`,
            chalk.gray(`(${durationMs}ms)`),
            claudeResponse.stop_reason === 'tool_use' ? chalk.yellow('→ tool_use') : ''
          );
        } else if (claudeResponse.type === 'error') {
          console.log(
            chalk.yellow('⚠'),
            chalk.white(`[${requestId.slice(0, 8)}]`),
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
