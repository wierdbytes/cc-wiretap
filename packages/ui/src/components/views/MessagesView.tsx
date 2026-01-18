import { JsonView, defaultStyles } from 'react-json-view-lite';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Request, ClaudeMessage, ClaudeContent, TextContent, ToolUseContent, ToolResultContent } from '@/lib/types';

interface MessagesViewProps {
  request: Request;
}

const jsonStyles = {
  ...defaultStyles,
  container: 'json-view text-xs',
  basicChildStyle: 'text-foreground',
  label: 'text-blue-400',
  nullValue: 'text-gray-500',
  stringValue: 'text-green-400',
  booleanValue: 'text-yellow-400',
  numberValue: 'text-purple-400',
  punctuation: 'text-gray-500',
};

function ContentBlock({ content }: { content: ClaudeContent }) {
  if (content.type === 'text') {
    const textContent = content as TextContent;
    return (
      <pre className="text-sm whitespace-pre-wrap font-sans">
        {textContent.text}
      </pre>
    );
  }

  if (content.type === 'tool_use') {
    const toolContent = content as ToolUseContent;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="warning">{toolContent.name}</Badge>
          <span className="text-xs text-muted-foreground font-mono">
            {toolContent.id}
          </span>
        </div>
        <div className="bg-background/50 rounded p-2">
          <JsonView data={toolContent.input} style={jsonStyles} />
        </div>
      </div>
    );
  }

  if (content.type === 'tool_result') {
    const resultContent = content as ToolResultContent;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant={resultContent.is_error ? 'destructive' : 'secondary'}>
            tool_result
          </Badge>
          <span className="text-xs text-muted-foreground font-mono">
            {resultContent.tool_use_id}
          </span>
        </div>
        <div className="bg-background/50 rounded p-2">
          {typeof resultContent.content === 'string' ? (
            <pre className="text-sm whitespace-pre-wrap font-mono max-h-48 overflow-auto">
              {resultContent.content}
            </pre>
          ) : (
            <JsonView data={resultContent.content} style={jsonStyles} />
          )}
        </div>
      </div>
    );
  }

  if (content.type === 'image') {
    return (
      <div className="text-sm text-muted-foreground">
        [Image content]
      </div>
    );
  }

  return (
    <div className="bg-background/50 rounded p-2">
      <JsonView data={content} style={jsonStyles} />
    </div>
  );
}

function MessageBlock({ message, index }: { message: ClaudeMessage; index: number }) {
  const isUser = message.role === 'user';

  // Content can be a string or an array of content blocks
  const contentArray = typeof message.content === 'string'
    ? [{ type: 'text' as const, text: message.content }]
    : Array.isArray(message.content) ? message.content : [];

  return (
    <div
      className={cn(
        'rounded-lg p-4 space-y-3',
        isUser ? 'bg-muted' : 'bg-primary/5 border border-primary/20'
      )}
    >
      <div className="flex items-center gap-2">
        <Badge variant={isUser ? 'secondary' : 'default'}>
          {message.role}
        </Badge>
        <span className="text-xs text-muted-foreground">#{index + 1}</span>
      </div>
      <div className="space-y-3">
        {contentArray.map((content, i) => (
          <ContentBlock key={i} content={content} />
        ))}
      </div>
    </div>
  );
}

export function MessagesView({ request }: MessagesViewProps) {
  const messages = request.requestBody?.messages || [];
  const response = request.response;
  const isMessageResponse = response?.type === 'message';
  const responseContent = isMessageResponse ? response.content : [];

  if (messages.length === 0 && responseContent.length === 0 && response?.type !== 'error') {
    return (
      <div className="text-sm text-muted-foreground">No messages</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Request Messages */}
      {messages.map((message, index) => (
        <MessageBlock key={index} message={message} index={index} />
      ))}

      {/* API Error */}
      {response?.type === 'error' && (
        <div className="rounded-lg p-4 space-y-3 bg-red-500/5 border border-red-500/20">
          <div className="flex items-center gap-2">
            <Badge variant="destructive">error</Badge>
            <span className="text-xs text-muted-foreground">{response.error.type}</span>
          </div>
          <pre className="text-sm whitespace-pre-wrap text-red-400">
            {response.error.message}
          </pre>
        </div>
      )}

      {/* Response */}
      {responseContent.length > 0 && (
        <div className="rounded-lg p-4 space-y-3 bg-green-500/5 border border-green-500/20">
          <div className="flex items-center gap-2">
            <Badge variant="success">assistant</Badge>
            <span className="text-xs text-muted-foreground">response</span>
            {isMessageResponse && response.stop_reason && (
              <Badge variant="outline" className="text-[10px]">
                {response.stop_reason}
              </Badge>
            )}
          </div>
          <div className="space-y-3">
            {responseContent.map((content, i) => (
              <ContentBlock key={i} content={content} />
            ))}
          </div>
        </div>
      )}

      {request.isStreaming && (
        <div className="text-sm text-muted-foreground animate-pulse">
          Streaming response...
        </div>
      )}
    </div>
  );
}
