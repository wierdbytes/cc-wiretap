# CC Wiretap

HTTP/HTTPS proxy for intercepting and visualizing Claude Code traffic.

## Project Structure

```
cc-wiretap/
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
NODE_EXTRA_CA_CERTS="$HOME/.cc-wiretap/ca.pem" \
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

## Package: @cc-wiretap/proxy

Backend proxy server using mockttp.

### Key Files

- `src/index.ts` - CLI entry point (commander)
- `src/types.ts` - Claude API TypeScript types
- `src/ca.ts` - CA certificate generation (~/.cc-wiretap/)
- `src/parser.ts` - SSE streaming parser
- `src/websocket.ts` - WebSocket server for UI communication
- `src/interceptor.ts` - Request/response interception logic
- `src/proxy.ts` - mockttp proxy configuration
- `src/setup-server.ts` - HTTP server for terminal setup scripts
- `src/ui-server.ts` - Static server for bundled UI (production builds)

### Dependencies

- mockttp - HTTPS proxy with MITM
- ws - WebSocket server
- commander - CLI framework
- chalk - Terminal styling
- open - Opens the dashboard URL in the default browser on startup

## Package: @cc-wiretap/ui

React frontend dashboard.

### Key Files

- `src/App.tsx` - Main app layout
- `src/stores/appStore.ts` - Zustand state management
- `src/hooks/useWebSocket.ts` - WebSocket connection hook
- `src/hooks/useHotkeys.ts` - Keyboard shortcut dispatcher
- `src/components/layout/Header.tsx` - Header with connection, tokens, rate limits
- `src/components/requests/RequestList.tsx` - Sidebar list of intercepted requests
- `src/components/requests/RequestItem.tsx` - Single row in the requests sidebar
- `src/components/views/SessionReportView.tsx` - Main request detail view
- `src/lib/types.ts` - TypeScript types (synced with proxy)

### UI Features

- Header - Connection status, request info, token usage, rate limits
- Requests panel (sidebar) - List of intercepted API requests
- Request detail view - Collapsible report with:
  - System prompt section
  - Available tools section (with schemas)
  - Messages (user/assistant) with preview when collapsed
  - Thinking blocks
  - Tool calls and results
  - Response with stop reason

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
| `R` | Reconnect WebSocket (only when disconnected) |
| `?` | Show hotkeys help |

Implementation: `useHotkeys` hook uses `event.code` for layout-independent keys. Hotkeys are disabled when dialogs are open or when a modifier (Ctrl/Alt/Meta/Shift) is held.

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

Messages are defined in `packages/proxy/src/types.ts`. All variants are broadcast proxy → UI except `clear_all`, which flows both ways (UI sends it to request a clear; proxy echoes it to all clients).

```typescript
type WSMessage =
  | { type: 'request_start'; requestId: string; timestamp: number; method: string; url: string; headers: Record<string, string> }
  | { type: 'request_body'; requestId: string; body: ClaudeRequest }
  | { type: 'response_start'; requestId: string; timestamp: number; statusCode: number; headers: Record<string, string> }
  | { type: 'response_chunk'; requestId: string; event: SSEEvent }
  | { type: 'response_complete'; requestId: string; timestamp: number; response: ClaudeResponse; durationMs: number }
  | { type: 'error'; requestId?: string; error: string; timestamp: number }
  | { type: 'clear_all' }
  | { type: 'history_sync'; requests: InterceptedRequest[] }
```

`history_sync` is sent once to each newly-connected client so late joiners see prior requests.

## CA Certificate

On first run, a CA certificate is generated at `~/.cc-wiretap/`:
- `ca.pem` - Certificate (use with NODE_EXTRA_CA_CERTS)
- `ca-key.pem` - Private key

To trust system-wide (macOS):
```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ~/.cc-wiretap/ca.pem
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

1. **Proxy intercepts** HTTPS traffic to `api.anthropic.com` and `api.claude.ai` (POST `/v1/messages` only — see `CLAUDE_API_HOSTS` in `interceptor.ts`)
2. **Interceptor** parses Claude API requests/responses
3. **SSE Parser** handles streaming responses in real-time
4. **WebSocket** broadcasts events to connected UI clients
5. **Setup Server** provides terminal configuration scripts
6. **UI Server** serves the bundled dashboard in production (dev uses Vite instead)
7. **UI Store** maintains state with Zustand
8. **React components** render the intercepted data

The proxy uses mockttp's `beforeRequest` and `beforeResponse` hooks to capture traffic without modifying it.
