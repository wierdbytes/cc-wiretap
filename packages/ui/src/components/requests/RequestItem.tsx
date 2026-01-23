import { Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTimestamp, formatDuration, extractModelName, formatTokenCount } from '@/lib/utils';
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
  const hasError = !!request.error || response?.type === 'error';

  // Calculate total input tokens including cache
  const totalInputTokens = isMessageResponse
    ? (response.usage.input_tokens || 0) +
      (response.usage.cache_read_input_tokens || 0) +
      (response.usage.cache_creation_input_tokens || 0)
    : undefined;
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
        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          {hasError && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              error
            </Badge>
          )}
          {totalInputTokens !== undefined && outputTokens !== undefined && (
            <span className="flex items-center gap-1">
              <ArrowUp className="h-3 w-3" />
              {formatTokenCount(totalInputTokens)}
              <ArrowDown className="h-3 w-3 ml-1" />
              {formatTokenCount(outputTokens)}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
        <span>{formatTimestamp(request.timestamp)}</span>
        {request.durationMs !== undefined && (
          <span>{formatDuration(request.durationMs)}</span>
        )}
      </div>
    </button>
  );
}
