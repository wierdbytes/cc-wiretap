import { formatTokenCount } from '@/lib/utils';
import type { ClaudeRequest, ClaudeResponse } from '@/lib/types';

interface TokenUsageViewProps {
  request?: ClaudeRequest;
  response?: ClaudeResponse;
}

interface UsageRowProps {
  label: string;
  value: number | undefined;
  description?: string;
}

function UsageRow({ label, value, description }: UsageRowProps) {
  if (value === undefined || value === 0) return null;

  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div>
        <span className="text-sm">{label}</span>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <span className="text-sm font-mono font-medium">
        {formatTokenCount(value)}
      </span>
    </div>
  );
}

export function TokenUsageView({ request, response }: TokenUsageViewProps) {
  const isMessageResponse = response?.type === 'message';
  const usage = isMessageResponse ? response.usage : undefined;

  if (!usage) {
    return (
      <div className="text-sm text-muted-foreground">
        {response?.type === 'error' ? `API Error: ${response.error.message}` : 'No usage data available yet'}
      </div>
    );
  }

  const totalInput =
    usage.input_tokens +
    (usage.cache_creation_input_tokens || 0) +
    (usage.cache_read_input_tokens || 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-muted rounded-lg p-4">
          <div className="text-2xl font-bold font-mono">
            {formatTokenCount(totalInput)}
          </div>
          <div className="text-sm text-muted-foreground">Input Tokens</div>
        </div>
        <div className="bg-muted rounded-lg p-4">
          <div className="text-2xl font-bold font-mono">
            {formatTokenCount(usage.output_tokens)}
          </div>
          <div className="text-sm text-muted-foreground">Output Tokens</div>
        </div>
      </div>

      {/* Details */}
      <div className="border border-border rounded-md">
        <div className="bg-muted px-3 py-2">
          <span className="text-sm font-medium">Token Breakdown</span>
        </div>
        <div className="p-3">
          <UsageRow
            label="Input Tokens"
            value={usage.input_tokens}
            description="Tokens from messages"
          />
          <UsageRow
            label="Cache Creation"
            value={usage.cache_creation_input_tokens}
            description="Tokens written to cache"
          />
          <UsageRow
            label="Cache Read"
            value={usage.cache_read_input_tokens}
            description="Tokens read from cache"
          />
          <UsageRow
            label="Output Tokens"
            value={usage.output_tokens}
            description="Tokens in response"
          />
        </div>
      </div>

      {/* Request Settings */}
      {request && (
        <div className="border border-border rounded-md">
          <div className="bg-muted px-3 py-2">
            <span className="text-sm font-medium">Request Settings</span>
          </div>
          <div className="p-3">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm">Model</span>
              <span className="text-sm font-mono">{request.model}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm">Max Tokens</span>
              <span className="text-sm font-mono">
                {formatTokenCount(request.max_tokens)}
              </span>
            </div>
            {request.temperature !== undefined && (
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm">Temperature</span>
                <span className="text-sm font-mono">{request.temperature}</span>
              </div>
            )}
            {request.top_p !== undefined && (
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm">Top P</span>
                <span className="text-sm font-mono">{request.top_p}</span>
              </div>
            )}
            {request.top_k !== undefined && (
              <div className="flex items-center justify-between py-2">
                <span className="text-sm">Top K</span>
                <span className="text-sm font-mono">{request.top_k}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stop Reason */}
      {isMessageResponse && response.stop_reason && (
        <div className="border border-border rounded-md">
          <div className="bg-muted px-3 py-2">
            <span className="text-sm font-medium">Stop Reason</span>
          </div>
          <div className="p-3">
            <span className="text-sm font-mono">{response.stop_reason}</span>
            {response.stop_sequence && (
              <span className="text-sm text-muted-foreground ml-2">
                (sequence: "{response.stop_sequence}")
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
