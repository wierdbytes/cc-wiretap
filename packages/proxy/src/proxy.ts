import * as mockttp from 'mockttp';
import chalk from 'chalk';
import { gunzipSync, brotliDecompressSync } from 'zlib';
import type { CAConfig } from './ca.js';
import { ClaudeInterceptor } from './interceptor.js';
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
}

export interface ProxyServer {
  server: mockttp.Mockttp;
  interceptor: ClaudeInterceptor;
  stop: () => Promise<void>;
}

export async function createProxy(options: ProxyOptions): Promise<ProxyServer> {
  const { port, ca, wsServer } = options;

  const server = mockttp.getLocal({
    https: {
      cert: ca.cert,
      key: ca.key,
    },
  });

  const interceptor = new ClaudeInterceptor(wsServer);

  // Track request IDs for matching requests to responses
  const requestIds = new Map<string, string>();

  // Handle all requests - passthrough with interception
  await server
    .forAnyRequest()
    .thenPassThrough({
      beforeRequest: async (request) => {
        const requestId = await interceptor.handleRequest(request);
        if (requestId) {
          // Store the request ID using the request's unique identifier
          requestIds.set(request.id, requestId);
        }
        return {};
      },
      beforeResponse: async (response) => {
        const requestId = requestIds.get(response.id);
        if (!requestId) {
          return {};
        }

        await interceptor.handleResponseStart(requestId, response.statusCode, response.headers as Record<string, string>);

        // Check if this is a streaming response
        const contentType = response.headers['content-type'] || '';
        const isStreaming = contentType.includes('text/event-stream');

        if (isStreaming) {
          // For streaming responses, we need to handle chunks
          // mockttp provides the body as a buffer
          const bodyBuffer = response.body.buffer;
          if (bodyBuffer.length > 0) {
            const bodyText = bodyBuffer.toString('utf-8');
            interceptor.handleResponseChunk(requestId, bodyText);
          }
          await interceptor.handleResponseComplete(requestId);
        } else {
          // Non-streaming response - decompress if needed
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

  return {
    server,
    interceptor,
    stop: async () => {
      await server.stop();
      console.log(chalk.gray('○'), 'Proxy server stopped');
    },
  };
}
