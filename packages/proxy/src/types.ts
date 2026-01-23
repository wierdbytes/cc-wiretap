// Claude API Types

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ClaudeContent[];
}

export type ClaudeContent =
  | TextContent
  | ImageContent
  | ToolUseContent
  | ToolResultContent;

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ClaudeContent[];
  is_error?: boolean;
}

export interface ClaudeRequest {
  model: string;
  max_tokens: number;
  messages: ClaudeMessage[];
  system?: string | SystemBlock[];
  stream?: boolean;
  tools?: ClaudeTool[];
  tool_choice?: ToolChoice;
  metadata?: Record<string, unknown>;
  stop_sequences?: string[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
}

export interface SystemBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolChoice {
  type: 'auto' | 'any' | 'tool';
  name?: string;
}

export interface ClaudeMessageResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: ClaudeContent[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;
  stop_sequence: string | null;
  usage: TokenUsage;
}

export interface ClaudeErrorResponse {
  type: 'error';
  error: {
    type: string;
    message: string;
  };
}

export type ClaudeResponse = ClaudeMessageResponse | ClaudeErrorResponse;

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

// SSE Event Types

export type SSEEvent =
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageDeltaEvent
  | MessageStopEvent
  | PingEvent
  | ErrorEvent;

export interface MessageStartEvent {
  type: 'message_start';
  message: {
    id: string;
    type: 'message';
    role: 'assistant';
    content: [];
    model: string;
    stop_reason: null;
    stop_sequence: null;
    usage: TokenUsage;
  };
}

export interface ContentBlockStartEvent {
  type: 'content_block_start';
  index: number;
  content_block: TextContent | ToolUseBlockStart;
}

export interface ToolUseBlockStart {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ContentBlockDeltaEvent {
  type: 'content_block_delta';
  index: number;
  delta: TextDelta | InputJsonDelta;
}

export interface TextDelta {
  type: 'text_delta';
  text: string;
}

export interface InputJsonDelta {
  type: 'input_json_delta';
  partial_json: string;
}

export interface ContentBlockStopEvent {
  type: 'content_block_stop';
  index: number;
}

export interface MessageDeltaEvent {
  type: 'message_delta';
  delta: {
    stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
    stop_sequence: string | null;
  };
  usage: {
    output_tokens: number;
  };
}

export interface MessageStopEvent {
  type: 'message_stop';
}

export interface PingEvent {
  type: 'ping';
}

export interface ErrorEvent {
  type: 'error';
  error: {
    type: string;
    message: string;
  };
}

// WebSocket Message Types (Proxy -> UI)

export type WSMessage =
  | WSRequestStart
  | WSRequestBody
  | WSResponseStart
  | WSResponseChunk
  | WSResponseComplete
  | WSError;

export interface WSRequestStart {
  type: 'request_start';
  requestId: string;
  timestamp: number;
  method: string;
  url: string;
  headers: Record<string, string>;
}

export interface WSRequestBody {
  type: 'request_body';
  requestId: string;
  body: ClaudeRequest;
}

export interface WSResponseStart {
  type: 'response_start';
  requestId: string;
  timestamp: number;
  statusCode: number;
  headers: Record<string, string>;
}

export interface WSResponseChunk {
  type: 'response_chunk';
  requestId: string;
  event: SSEEvent;
}

export interface WSResponseComplete {
  type: 'response_complete';
  requestId: string;
  timestamp: number;
  response: ClaudeResponse;
  durationMs: number;
}

export interface WSError {
  type: 'error';
  requestId?: string;
  error: string;
  timestamp: number;
}

// Internal Types

export interface InterceptedRequest {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody?: ClaudeRequest;
  responseStartTime?: number;
  statusCode?: number;
  responseHeaders?: Record<string, string>;
  sseEvents: SSEEvent[];
  response?: ClaudeResponse;
  durationMs?: number;
  error?: string;
}
