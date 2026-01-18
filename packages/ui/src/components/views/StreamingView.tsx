import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import type { Request, SSEEvent, ContentBlockDeltaEvent } from '@/lib/types';

interface StreamingViewProps {
  request: Request;
}

function extractStreamingText(events: SSEEvent[]): string {
  const textParts: string[] = [];
  for (const event of events) {
    if (event.type === 'content_block_delta') {
      const deltaEvent = event as ContentBlockDeltaEvent;
      if (deltaEvent.delta.type === 'text_delta') {
        textParts.push(deltaEvent.delta.text);
      }
    }
  }
  return textParts.join('');
}

function extractToolJsonParts(events: SSEEvent[]): Map<number, { name: string; id: string; json: string }> {
  const tools = new Map<number, { name: string; id: string; json: string }>();

  for (const event of events) {
    if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
      tools.set(event.index, {
        name: event.content_block.name,
        id: event.content_block.id,
        json: '',
      });
    } else if (event.type === 'content_block_delta') {
      const deltaEvent = event as ContentBlockDeltaEvent;
      if (deltaEvent.delta.type === 'input_json_delta') {
        const tool = tools.get(deltaEvent.index);
        if (tool) {
          tool.json += deltaEvent.delta.partial_json;
        }
      }
    }
  }

  return tools;
}

export function StreamingView({ request }: StreamingViewProps) {
  const events = request.sseEvents;

  const streamingText = useMemo(() => extractStreamingText(events), [events]);
  const toolCalls = useMemo(() => extractToolJsonParts(events), [events]);

  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const event of events) {
      counts[event.type] = (counts[event.type] || 0) + 1;
    }
    return counts;
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        {request.isStreaming ? 'Waiting for events...' : 'No SSE events recorded'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Event Summary */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(eventCounts).map(([type, count]) => (
          <Badge key={type} variant="secondary" className="text-xs">
            {type}: {count}
          </Badge>
        ))}
      </div>

      {/* Streaming Text Output */}
      {streamingText && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Text Output</h3>
          <div className="bg-muted rounded-md p-4">
            <pre className="text-sm whitespace-pre-wrap font-sans">
              {streamingText}
              {request.isStreaming && (
                <span className="animate-pulse text-primary">▊</span>
              )}
            </pre>
          </div>
        </div>
      )}

      {/* Tool Calls */}
      {toolCalls.size > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Tool Calls</h3>
          {Array.from(toolCalls.values()).map((tool, index) => (
            <div key={index} className="border border-border rounded-md overflow-hidden">
              <div className="bg-muted px-3 py-2 flex items-center gap-2">
                <Badge variant="warning">{tool.name}</Badge>
                <span className="text-xs text-muted-foreground font-mono">
                  {tool.id}
                </span>
              </div>
              <pre className="p-4 text-sm font-mono whitespace-pre-wrap overflow-auto max-h-48">
                {tool.json || '{}'}
              </pre>
            </div>
          ))}
        </div>
      )}

      {/* Raw Events Timeline */}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
          Raw Event Timeline ({events.length} events)
        </summary>
        <div className="mt-2 space-y-1 max-h-96 overflow-auto">
          {events.map((event, index) => (
            <div
              key={index}
              className="flex items-start gap-2 py-1 border-b border-border/50 last:border-0"
            >
              <span className="text-xs text-muted-foreground w-8 shrink-0">
                #{index}
              </span>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {event.type}
              </Badge>
              <span className="text-xs text-muted-foreground truncate">
                {getEventPreview(event)}
              </span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function getEventPreview(event: SSEEvent): string {
  switch (event.type) {
    case 'message_start':
      return `id: ${event.message.id}, model: ${event.message.model}`;
    case 'content_block_start':
      return `index: ${event.index}, type: ${event.content_block.type}`;
    case 'content_block_delta':
      if (event.delta.type === 'text_delta') {
        const text = event.delta.text;
        return text.length > 50 ? text.slice(0, 50) + '...' : text;
      }
      if (event.delta.type === 'input_json_delta') {
        const json = event.delta.partial_json;
        return json.length > 50 ? json.slice(0, 50) + '...' : json;
      }
      return '';
    case 'content_block_stop':
      return `index: ${event.index}`;
    case 'message_delta':
      return `stop_reason: ${event.delta.stop_reason}, output_tokens: ${event.usage.output_tokens}`;
    case 'message_stop':
      return '';
    case 'ping':
      return '';
    case 'error':
      return event.error.message;
    default:
      return '';
  }
}
