import { useState } from 'react';
import { JsonView, defaultStyles } from 'react-json-view-lite';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Request } from '@/lib/types';

interface RawJsonViewProps {
  request: Request;
}

const jsonStyles = {
  ...defaultStyles,
  container: 'json-view',
  basicChildStyle: 'text-foreground',
  label: 'text-blue-400',
  nullValue: 'text-gray-500',
  undefinedValue: 'text-gray-500',
  stringValue: 'text-green-400',
  booleanValue: 'text-yellow-400',
  numberValue: 'text-purple-400',
  otherValue: 'text-foreground',
  punctuation: 'text-gray-500',
  collapseIcon: 'text-muted-foreground cursor-pointer',
  expandIcon: 'text-muted-foreground cursor-pointer',
};

export function RawJsonView({ request }: RawJsonViewProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (data: unknown, label: string) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Tabs defaultValue="request" className="space-y-4">
      <TabsList>
        <TabsTrigger value="request">Request</TabsTrigger>
        <TabsTrigger value="response">Response</TabsTrigger>
        <TabsTrigger value="headers">Headers</TabsTrigger>
        <TabsTrigger value="sse">SSE Events</TabsTrigger>
      </TabsList>

      <TabsContent value="request" className="space-y-2">
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(request.requestBody, 'request')}
          >
            {copied === 'request' ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        {request.requestBody ? (
          <div className="bg-muted rounded-md p-4 overflow-auto max-h-[600px]">
            <JsonView data={request.requestBody} style={jsonStyles} />
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No request body</div>
        )}
      </TabsContent>

      <TabsContent value="response" className="space-y-2">
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(request.response, 'response')}
          >
            {copied === 'response' ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        {request.response ? (
          <div className="bg-muted rounded-md p-4 overflow-auto max-h-[600px]">
            <JsonView data={request.response} style={jsonStyles} />
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            {request.isStreaming ? 'Response is streaming...' : 'No response yet'}
          </div>
        )}
      </TabsContent>

      <TabsContent value="headers" className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-2">Request Headers</h4>
          <div className="bg-muted rounded-md p-4 overflow-auto max-h-[300px]">
            <JsonView data={request.requestHeaders} style={jsonStyles} />
          </div>
        </div>
        {request.responseHeaders && (
          <div>
            <h4 className="text-sm font-medium mb-2">Response Headers</h4>
            <div className="bg-muted rounded-md p-4 overflow-auto max-h-[300px]">
              <JsonView data={request.responseHeaders} style={jsonStyles} />
            </div>
          </div>
        )}
      </TabsContent>

      <TabsContent value="sse" className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">
            {request.sseEvents.length} events
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(request.sseEvents, 'sse')}
          >
            {copied === 'sse' ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        {request.sseEvents.length > 0 ? (
          <div className="bg-muted rounded-md p-4 overflow-auto max-h-[600px]">
            <JsonView data={request.sseEvents} style={jsonStyles} />
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No SSE events</div>
        )}
      </TabsContent>
    </Tabs>
  );
}
