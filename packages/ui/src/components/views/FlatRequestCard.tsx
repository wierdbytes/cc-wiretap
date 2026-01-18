import { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MessagesView } from './MessagesView';
import { SystemPromptView } from './SystemPromptView';
import { ToolCallsView } from './ToolCallsView';
import { TokenUsageView } from './TokenUsageView';
import { RawJsonView } from './RawJsonView';
import { formatTimestamp, formatDuration, formatTokenCount, extractModelName } from '@/lib/utils';
import type { Request } from '@/lib/types';

interface FlatRequestCardProps {
  request: Request;
}

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}

function CollapsibleSection({ title, children, defaultOpen = false, badge }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        {title}
        {badge && (
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {badge}
          </Badge>
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}

export function FlatRequestCard({ request }: FlatRequestCardProps) {
  const model = request.requestBody?.model;
  const isError = request.error || request.response?.type === 'error';
  const isStreaming = request.isStreaming;
  const usage = request.response?.type === 'message' ? request.response.usage : undefined;

  const hasSystemPrompt = !!request.requestBody?.system;
  const hasTools = (request.requestBody?.tools?.length ?? 0) > 0 ||
    (request.response?.type === 'message' && request.response.content.some(c => c.type === 'tool_use'));

  const totalInputTokens = usage
    ? usage.input_tokens + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0)
    : undefined;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-muted/30 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {model && (
              <Badge variant="default" className="font-mono">
                {extractModelName(model)}
              </Badge>
            )}
            {isError ? (
              <Badge variant="destructive">Error</Badge>
            ) : isStreaming ? (
              <Badge variant="warning">Streaming</Badge>
            ) : request.statusCode ? (
              <Badge variant={request.statusCode === 200 ? 'success' : 'destructive'}>
                {request.statusCode}
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="font-mono">{formatTimestamp(request.timestamp)}</span>
            {request.durationMs && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(request.durationMs)}
              </span>
            )}
          </div>
        </div>

        {/* Token Summary */}
        {usage && (
          <div className="flex items-center gap-4 mt-2 text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Zap className="h-3 w-3" />
              <span className="font-mono">
                In: {formatTokenCount(totalInputTokens!)}
              </span>
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <span className="font-mono">
                Out: {formatTokenCount(usage.output_tokens)}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Messages - Always Visible */}
      <div className="p-4">
        <MessagesView request={request} />
      </div>

      {/* Collapsible Sections */}
      {hasSystemPrompt && (
        <CollapsibleSection title="System Prompt">
          <SystemPromptView system={request.requestBody?.system} />
        </CollapsibleSection>
      )}

      {hasTools && (
        <CollapsibleSection
          title="Tools"
          badge={`${request.requestBody?.tools?.length || 0} available`}
        >
          <ToolCallsView
            tools={request.requestBody?.tools}
            response={request.response}
          />
        </CollapsibleSection>
      )}

      {usage && (
        <CollapsibleSection title="Token Usage">
          <TokenUsageView
            request={request.requestBody}
            response={request.response}
          />
        </CollapsibleSection>
      )}

      <CollapsibleSection title="Raw JSON">
        <RawJsonView request={request} />
      </CollapsibleSection>
    </div>
  );
}
