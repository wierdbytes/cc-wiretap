import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTimestamp, formatDuration, extractModelName } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { Request } from '@/lib/types';

interface RequestItemProps {
  request: Request;
  isSelected: boolean;
  onClick: () => void;
}

export function RequestItem({ request, isSelected, onClick }: RequestItemProps) {
  const model = request.requestBody?.model || 'unknown';
  const response = request.response;
  const isMessageResponse = response?.type === 'message';
  const hasToolUse = isMessageResponse && response.stop_reason === 'tool_use';
  const hasError = !!request.error || response?.type === 'error';
  const inputTokens = isMessageResponse ? response.usage.input_tokens : undefined;
  const outputTokens = isMessageResponse ? response.usage.output_tokens : undefined;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2 border-b border-border transition-colors',
        'hover:bg-accent',
        isSelected && 'bg-accent'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {request.isStreaming && (
            <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
          )}
          <span className="text-sm font-medium truncate">
            {extractModelName(model)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasToolUse && (
            <Badge variant="warning" className="text-[10px] px-1.5 py-0">
              tool
            </Badge>
          )}
          {hasError && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              error
            </Badge>
          )}
          {request.statusCode && (
            <Badge
              variant={request.statusCode >= 400 ? 'destructive' : 'secondary'}
              className="text-[10px] px-1.5 py-0"
            >
              {request.statusCode}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
        <span>{formatTimestamp(request.timestamp)}</span>
        <div className="flex items-center gap-2">
          {inputTokens !== undefined && outputTokens !== undefined && (
            <span>
              {inputTokens} / {outputTokens}
            </span>
          )}
          {request.durationMs !== undefined && (
            <span>{formatDuration(request.durationMs)}</span>
          )}
        </div>
      </div>
    </button>
  );
}
