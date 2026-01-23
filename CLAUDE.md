# Claude Wiretap

HTTP/HTTPS proxy for intercepting and visualizing Claude Code traffic.

## Project Structure

```
claude-wiretap/
├── packages/
│   ├── proxy/          # Backend - Node.js proxy server
│   └── ui/             # Frontend - React + Vite dashboard
├── package.json        # Monorepo root (pnpm workspaces)
├── pnpm-workspace.yaml
├── turbo.json          # Turbo build tasks
└── tsconfig.base.json  # Shared TypeScript config
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Start dev servers (proxy + UI)
pnpm dev

# Build for production
pnpm build
```

## Using the Proxy

### Method 1: One-liner setup (recommended)

Run this in any terminal to configure it for proxying:

```bash
eval "$(curl -s http://localhost:8082/setup)"
```

This sets all necessary environment variables (`HTTP_PROXY`, `HTTPS_PROXY`, `NODE_EXTRA_CA_CERTS`, etc.) for the current shell session. All HTTP/HTTPS traffic from that terminal will be intercepted.

To disable:
```bash
unset-wiretap
```

For Fish shell:
```bash
eval (curl -s http://localhost:8082/setup?shell=fish)
```

### Method 2: Manual setup

```bash
NODE_EXTRA_CA_CERTS="/Users/mentor/.claude-wiretap/ca.pem" \
HTTPS_PROXY=http://localhost:8080 \
claude
```

## Ports

| Port | Service |
|------|---------|
| 8080 | HTTP/HTTPS proxy |
| 8081 | WebSocket server (proxy → UI) |
| 8082 | Setup server (terminal eval endpoint) |
| 3000 | UI dev server (Vite) |

## Package: @claude-wiretap/proxy

Backend proxy server using mockttp.

### Key Files

- `src/index.ts` - CLI entry point (commander)
- `src/types.ts` - Claude API TypeScript types
- `src/ca.ts` - CA certificate generation (~/.claude-wiretap/)
- `src/parser.ts` - SSE streaming parser
- `src/websocket.ts` - WebSocket server for UI communication
- `src/interceptor.ts` - Request/response interception logic
- `src/proxy.ts` - mockttp proxy configuration
- `src/setup-server.ts` - HTTP server for terminal setup scripts

### Dependencies

- mockttp - HTTPS proxy with MITM
- ws - WebSocket server
- commander - CLI framework
- chalk - Terminal styling

## Package: @claude-wiretap/ui

React frontend dashboard.

### Key Files

- `src/App.tsx` - Main app layout
- `src/stores/appStore.ts` - Zustand state management
- `src/hooks/useWebSocket.ts` - WebSocket connection hook
- `src/components/requests/RequestDetail.tsx` - Main detail view
- `src/lib/types.ts` - TypeScript types (synced with proxy)

### UI Features

- Sessions panel - List of intercepted sessions
- Requests panel - Requests within selected session
- Detail tabs:
  - Messages - Conversation view
  - Streaming - Live SSE events
  - System - System prompt blocks
  - Tools - Tool definitions and calls
  - Usage - Token counts and settings
  - Raw JSON - Complete request/response data

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `S` | Toggle sidebar |
| `F` | Fold all blocks |
| `E` | Expand all blocks |
| `Space` | Select last request |
| `1` | Toggle system prompt |
| `2` | Toggle tools |
| `3` | Toggle messages |
| `X` | Clear all requests |
| `?` | Show hotkeys help |

Implementation: `useHotkeys` hook uses `event.code` for layout-independent keys. Hotkeys are disabled when dialogs are open.

### Tech Stack

- React 19
- Vite 7
- Tailwind CSS 4
- Zustand (state)
- Radix UI (primitives)
- react-json-view-lite

## Setup Server API

The setup server (port 8082) provides endpoints for terminal configuration:

| Endpoint | Description |
|----------|-------------|
| `GET /setup` | Returns bash script for proxy setup |
| `GET /setup?shell=fish` | Returns fish script for proxy setup |
| `GET /status` | Returns JSON with proxy status |

The setup script configures these environment variables:
- `HTTP_PROXY`, `HTTPS_PROXY` - Proxy address
- `NODE_EXTRA_CA_CERTS` - Node.js CA certificate
- `SSL_CERT_FILE`, `REQUESTS_CA_BUNDLE` - Python/OpenSSL
- `CURL_CA_BUNDLE` - curl
- `GIT_SSL_CAINFO` - Git HTTPS
- `AWS_CA_BUNDLE` - AWS CLI
- `NO_PROXY` - Localhost exclusions

## WebSocket Protocol

Messages from proxy to UI:

```typescript
type WSMessage =
  | { type: 'session_start'; sessionId: string; timestamp: number }
  | { type: 'request_start'; sessionId: string; requestId: string; ... }
  | { type: 'request_body'; sessionId: string; requestId: string; body: ClaudeRequest }
  | { type: 'response_start'; sessionId: string; requestId: string; statusCode: number; ... }
  | { type: 'response_chunk'; sessionId: string; requestId: string; event: SSEEvent }
  | { type: 'response_complete'; sessionId: string; requestId: string; response: ClaudeResponse; ... }
  | { type: 'error'; sessionId: string; requestId?: string; error: string; ... }
```

## CA Certificate

On first run, a CA certificate is generated at `~/.claude-wiretap/`:
- `ca.pem` - Certificate (use with NODE_EXTRA_CA_CERTS)
- `ca-key.pem` - Private key

To trust system-wide (macOS):
```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ~/.claude-wiretap/ca.pem
```

## Development

```bash
# Run both packages in dev mode
pnpm dev

# Build both packages
pnpm build

# Clean build artifacts
pnpm clean
```

## Architecture Notes

1. **Proxy intercepts** all HTTPS traffic to api.anthropic.com
2. **Interceptor** parses Claude API requests/responses
3. **SSE Parser** handles streaming responses in real-time
4. **WebSocket** broadcasts events to connected UI clients
5. **Setup Server** provides terminal configuration scripts
6. **UI Store** maintains state with Zustand
7. **React components** render the intercepted data

The proxy uses mockttp's `beforeRequest` and `beforeResponse` hooks to capture traffic without modifying it.
