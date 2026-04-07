import * as mockttp from 'mockttp';
import chalk from 'chalk';
import { gunzipSync, brotliDecompressSync } from 'zlib';
import type { CAConfig } from './ca.js';
import { ClaudeInterceptor } from './interceptor.js';
import { detectEndpoint, type EndpointInfo } from './endpoint-detector.js';
import type { WiretapWebSocketServer } from './websocket.js';

function decompressBody(buffer: Buffer, contentEncoding: string | undefined): string {
  if (!buffer.length) return '';

  try {
    if (contentEncoding === 'gzip') {
      return gunzipSync(buffer).toString('utf-8');
    }
    if (contentEncoding === 'br') {
      return brotliDecompressSync(buffer).toString('utf-8');
    }
  } catch {
    // If decompression fails, try as plain text
  }

  return buffer.toString('utf-8');
}

export interface ProxyOptions {
  port: number;
  ca: CAConfig;
  wsServer: WiretapWebSocketServer;
  endpointInfo?: EndpointInfo;
}

export interface ProxyServer {
  server: mockttp.Mockttp;
  interceptor: ClaudeInterceptor;
  endpointInfo: EndpointInfo;
  stop: () => Promise<void>;
}

export async function createProxy(options: ProxyOptions): Promise<ProxyServer> {
  const { port, ca, wsServer, endpointInfo: providedEndpointInfo } = options;

  // Determine endpoint if not provided
  const endpointInfo = providedEndpointInfo || detectEndpoint();

  const server = mockttp.getLocal({
    https: {
      cert: ca.cert,
      key: ca.key,
    },
  });

  const interceptor = new ClaudeInterceptor(wsServer);

  // Track request IDs for matching requests to responses
  const requestIds = new Map<string, string>();

  // All requests pass through - we intercept Claude API traffic based on path
  await server
    .forAnyRequest()
    .thenPassThrough({
      beforeRequest: async (request) => {
        // Check if this is a Claude API request (based on path, not host)
        const path = new URL(request.url).pathname;
        const isClaudeRequest = path.includes('/v1/messages') && request.method === 'POST';

        if (isClaudeRequest) {
          const requestId = await interceptor.handleRequest(request);
          if (requestId) {
            requestIds.set(request.id, requestId);
          }
        }
        return {};
      },
      beforeResponse: async (response) => {
        // Only process if we have a tracked request ID
        const requestId = requestIds.get(response.id);
        if (!requestId) {
          return {};
        }

        await interceptor.handleResponseStart(requestId, response.statusCode, response.headers as Record<string, string>);

        // Check if this is a streaming response
        const contentType = response.headers['content-type'] || '';
        const isStreaming = contentType.includes('text/event-stream');

        if (isStreaming) {
          const bodyBuffer = response.body.buffer;
          if (bodyBuffer.length > 0) {
            const bodyText = bodyBuffer.toString('utf-8');
            interceptor.handleResponseChunk(requestId, bodyText);
          }
          await interceptor.handleResponseComplete(requestId);
        } else {
          const bodyBuffer = response.body.buffer;
          const contentEncoding = response.headers['content-encoding'] as string | undefined;
          const bodyText = decompressBody(bodyBuffer, contentEncoding);
          interceptor.handleNonStreamingResponse(requestId, response.statusCode, bodyText);
        }

        requestIds.delete(response.id);
        return {};
      },
    });

  await server.start(port);

  console.log(chalk.green('✓'), `Proxy server started on port ${chalk.cyan(port)}`);
  console.log(chalk.gray('  Endpoint:'), endpointInfo.source, chalk.cyan(endpointInfo.url));
  console.log(chalk.gray('  All Claude API traffic: intercepted and displayed in UI'));

  return {
    server,
    interceptor,
    endpointInfo,
    stop: async () => {
      await server.stop();
      console.log(chalk.gray('○'), 'Proxy server stopped');
    },
  };
}
