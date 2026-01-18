import { JsonView, defaultStyles } from 'react-json-view-lite';
import { Badge } from '@/components/ui/badge';
import type { ClaudeTool, ClaudeResponse, ToolUseContent } from '@/lib/types';

interface ToolCallsViewProps {
  tools?: ClaudeTool[];
  response?: ClaudeResponse;
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

export function ToolCallsView({ tools, response }: ToolCallsViewProps) {
  // Extract tool uses from response (only for message responses)
  const toolUses = response?.type === 'message'
    ? response.content.filter((c): c is ToolUseContent => c.type === 'tool_use')
    : [];

  return (
    <div className="space-y-6">
      {/* Tool Uses in Response */}
      {toolUses.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Tool Calls in Response</h3>
          {toolUses.map((toolUse) => (
            <div key={toolUse.id} className="border border-border rounded-md overflow-hidden">
              <div className="bg-muted px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="warning">{toolUse.name}</Badge>
                  <span className="text-xs text-muted-foreground font-mono">
                    {toolUse.id}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <JsonView data={toolUse.input} style={jsonStyles} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Available Tools */}
      {tools && tools.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Available Tools ({tools.length})</h3>
          {tools.map((tool, index) => (
            <div key={index} className="border border-border rounded-md overflow-hidden">
              <div className="bg-muted px-3 py-2">
                <span className="text-sm font-medium">{tool.name}</span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-muted-foreground">{tool.description}</p>
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Input Schema
                  </summary>
                  <div className="mt-2">
                    <JsonView data={tool.input_schema} style={jsonStyles} />
                  </div>
                </details>
              </div>
            </div>
          ))}
        </div>
      )}

      {!tools?.length && !toolUses.length && (
        <div className="text-sm text-muted-foreground">No tools defined</div>
      )}
    </div>
  );
}
