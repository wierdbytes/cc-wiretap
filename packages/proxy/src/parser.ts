import type {
  SSEEvent,
  ClaudeMessageResponse,
  ClaudeContent,
  TextContent,
  ToolUseContent,
  TokenUsage,
  ContentBlockStartEvent,
  ContentBlockDeltaEvent,
  MessageStartEvent,
  MessageDeltaEvent,
} from './types.js';

/**
 * Parses a raw SSE data string into an SSEEvent
 */
export function parseSSELine(line: string): SSEEvent | null {
  if (!line.startsWith('data: ')) {
    return null;
  }

  const jsonStr = line.slice(6).trim();
  if (!jsonStr || jsonStr === '[DONE]') {
    return null;
  }

  try {
    return JSON.parse(jsonStr) as SSEEvent;
  } catch {
    return null;
  }
}

/**
 * Parses a complete SSE stream chunk (may contain multiple events)
 */
export function parseSSEChunk(chunk: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const lines = chunk.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('data: ')) {
      const event = parseSSELine(trimmed);
      if (event) {
        events.push(event);
      }
    }
  }

  return events;
}

/**
 * SSE Stream Parser class for handling streaming data
 */
export class SSEStreamParser {
  private buffer = '';
  private events: SSEEvent[] = [];

  /**
   * Feed data to the parser
   */
  feed(data: string): SSEEvent[] {
    this.buffer += data;
    const newEvents: SSEEvent[] = [];

    // Split on double newlines (SSE event separator)
    const parts = this.buffer.split('\n\n');

    // Keep the last part in the buffer (might be incomplete)
    this.buffer = parts.pop() || '';

    for (const part of parts) {
      const lines = part.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const event = parseSSELine(trimmed);
          if (event) {
            newEvents.push(event);
            this.events.push(event);
          }
        }
      }
    }

    return newEvents;
  }

  /**
   * Flush any remaining buffered data
   */
  flush(): SSEEvent[] {
    if (!this.buffer.trim()) {
      return [];
    }

    const events = parseSSEChunk(this.buffer);
    this.events.push(...events);
    this.buffer = '';
    return events;
  }

  /**
   * Get all parsed events
   */
  getAllEvents(): SSEEvent[] {
    return [...this.events];
  }

  /**
   * Reset the parser
   */
  reset(): void {
    this.buffer = '';
    this.events = [];
  }
}

/**
 * Reconstructs a complete ClaudeMessageResponse from SSE events.
 * Streaming responses are always message responses (errors are non-streaming).
 */
export function reconstructResponseFromEvents(events: SSEEvent[]): ClaudeMessageResponse | null {
  let messageStart: MessageStartEvent | null = null;
  let messageDelta: MessageDeltaEvent | null = null;
  const contentBlocks: Map<number, { type: string; content: Partial<ClaudeContent> }> = new Map();
  const textDeltas: Map<number, string[]> = new Map();
  const jsonDeltas: Map<number, string[]> = new Map();

  for (const event of events) {
    switch (event.type) {
      case 'message_start':
        messageStart = event;
        break;

      case 'content_block_start': {
        const startEvent = event as ContentBlockStartEvent;
        contentBlocks.set(startEvent.index, {
          type: startEvent.content_block.type,
          content: { ...startEvent.content_block },
        });
        if (startEvent.content_block.type === 'text') {
          textDeltas.set(startEvent.index, []);
        } else if (startEvent.content_block.type === 'tool_use') {
          jsonDeltas.set(startEvent.index, []);
        }
        break;
      }

      case 'content_block_delta': {
        const deltaEvent = event as ContentBlockDeltaEvent;
        if (deltaEvent.delta.type === 'text_delta') {
          const deltas = textDeltas.get(deltaEvent.index) || [];
          deltas.push(deltaEvent.delta.text);
          textDeltas.set(deltaEvent.index, deltas);
        } else if (deltaEvent.delta.type === 'input_json_delta') {
          const deltas = jsonDeltas.get(deltaEvent.index) || [];
          deltas.push(deltaEvent.delta.partial_json);
          jsonDeltas.set(deltaEvent.index, deltas);
        }
        break;
      }

      case 'message_delta':
        messageDelta = event;
        break;
    }
  }

  if (!messageStart) {
    return null;
  }

  // Build content array
  const content: ClaudeContent[] = [];
  const sortedIndices = Array.from(contentBlocks.keys()).sort((a, b) => a - b);

  for (const index of sortedIndices) {
    const block = contentBlocks.get(index)!;

    if (block.type === 'text') {
      const text = (textDeltas.get(index) || []).join('');
      content.push({
        type: 'text',
        text,
      } as TextContent);
    } else if (block.type === 'tool_use') {
      const jsonStr = (jsonDeltas.get(index) || []).join('');
      let input: Record<string, unknown> = {};
      try {
        input = jsonStr ? JSON.parse(jsonStr) : {};
      } catch {
        // Keep empty object if parsing fails
      }
      content.push({
        type: 'tool_use',
        id: (block.content as ToolUseContent).id || '',
        name: (block.content as ToolUseContent).name || '',
        input,
      } as ToolUseContent);
    }
  }

  // Calculate total usage
  const usage: TokenUsage = {
    input_tokens: messageStart.message.usage.input_tokens,
    output_tokens: messageDelta?.usage.output_tokens || messageStart.message.usage.output_tokens,
    cache_creation_input_tokens: messageStart.message.usage.cache_creation_input_tokens,
    cache_read_input_tokens: messageStart.message.usage.cache_read_input_tokens,
  };

  return {
    id: messageStart.message.id,
    type: 'message',
    role: 'assistant',
    content,
    model: messageStart.message.model,
    stop_reason: messageDelta?.delta.stop_reason || null,
    stop_sequence: messageDelta?.delta.stop_sequence || null,
    usage,
  };
}

/**
 * Extracts text content from SSE events (useful for live preview)
 */
export function extractTextFromEvents(events: SSEEvent[]): string {
  const textParts: string[] = [];

  for (const event of events) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      textParts.push(event.delta.text);
    }
  }

  return textParts.join('');
}

/**
 * Extracts tool calls from SSE events
 */
export function extractToolCallsFromEvents(events: SSEEvent[]): ToolUseContent[] {
  const tools: Map<number, { id: string; name: string; jsonParts: string[] }> = new Map();

  for (const event of events) {
    if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
      tools.set(event.index, {
        id: event.content_block.id,
        name: event.content_block.name,
        jsonParts: [],
      });
    } else if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'input_json_delta'
    ) {
      const tool = tools.get(event.index);
      if (tool) {
        tool.jsonParts.push(event.delta.partial_json);
      }
    }
  }

  return Array.from(tools.values()).map((tool) => {
    let input: Record<string, unknown> = {};
    try {
      const jsonStr = tool.jsonParts.join('');
      input = jsonStr ? JSON.parse(jsonStr) : {};
    } catch {
      // Keep empty object
    }
    return {
      type: 'tool_use' as const,
      id: tool.id,
      name: tool.name,
      input,
    };
  });
}
