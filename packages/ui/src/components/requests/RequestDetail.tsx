import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useSelectedRequest } from '@/stores/appStore';
import { formatTimestamp, formatDuration, extractModelName } from '@/lib/utils';
import { SystemPromptView } from '@/components/views/SystemPromptView';
import { ToolCallsView } from '@/components/views/ToolCallsView';
import { TokenUsageView } from '@/components/views/TokenUsageView';
import { RawJsonView } from '@/components/views/RawJsonView';
import { MessagesView } from '@/components/views/MessagesView';
import { StreamingView } from '@/components/views/StreamingView';

export function RequestDetail() {
  const request = useSelectedRequest();

  if (!request) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        Select a request to view details
      </div>
    );
  }

  const model = request.requestBody?.model || 'unknown';
  const hasTools = (request.requestBody?.tools?.length ?? 0) > 0;
  const hasSystem = !!request.requestBody?.system;
  const hasToolUse = request.response?.type === 'message' && request.response.stop_reason === 'tool_use';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{extractModelName(model)}</h2>
            {request.statusCode && (
              <Badge variant={request.statusCode >= 400 ? 'destructive' : 'success'}>
                {request.statusCode}
              </Badge>
            )}
            {request.isStreaming && (
              <Badge variant="info">streaming</Badge>
            )}
            {hasToolUse && (
              <Badge variant="warning">tool_use</Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {formatTimestamp(request.timestamp)}
            {request.durationMs !== undefined && (
              <span className="ml-2">({formatDuration(request.durationMs)})</span>
            )}
          </div>
        </div>
        <div className="text-sm text-muted-foreground font-mono truncate">
          {request.url}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="messages" className="flex-1 flex flex-col min-h-0">
        <div className="border-b border-border px-4">
          <TabsList className="h-10 bg-transparent">
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="streaming">Streaming</TabsTrigger>
            {hasSystem && <TabsTrigger value="system">System</TabsTrigger>}
            {hasTools && <TabsTrigger value="tools">Tools</TabsTrigger>}
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="raw">Raw JSON</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 min-h-0">
          <TabsContent value="messages" className="h-full m-0">
            <ScrollArea className="h-full">
              <div className="p-4">
                <MessagesView request={request} />
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="streaming" className="h-full m-0">
            <ScrollArea className="h-full">
              <div className="p-4">
                <StreamingView request={request} />
              </div>
            </ScrollArea>
          </TabsContent>

          {hasSystem && (
            <TabsContent value="system" className="h-full m-0">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <SystemPromptView system={request.requestBody?.system} />
                </div>
              </ScrollArea>
            </TabsContent>
          )}

          {hasTools && (
            <TabsContent value="tools" className="h-full m-0">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <ToolCallsView
                    tools={request.requestBody?.tools}
                    response={request.response}
                  />
                </div>
              </ScrollArea>
            </TabsContent>
          )}

          <TabsContent value="usage" className="h-full m-0">
            <ScrollArea className="h-full">
              <div className="p-4">
                <TokenUsageView
                  request={request.requestBody}
                  response={request.response}
                />
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="raw" className="h-full m-0">
            <ScrollArea className="h-full">
              <div className="p-4">
                <RawJsonView request={request} />
              </div>
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
