import { Badge } from '@/components/ui/badge';
import type { SystemBlock } from '@/lib/types';

interface SystemPromptViewProps {
  system?: string | SystemBlock[];
}

export function SystemPromptView({ system }: SystemPromptViewProps) {
  if (!system) {
    return (
      <div className="text-sm text-muted-foreground">No system prompt</div>
    );
  }

  if (typeof system === 'string') {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium">System Prompt</h3>
        <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-md font-mono">
          {system}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">System Prompt Blocks</h3>
      {system.map((block, index) => (
        <div key={index} className="border border-border rounded-md overflow-hidden">
          <div className="bg-muted px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-medium">Block {index + 1}</span>
            {block.cache_control && (
              <Badge variant="info" className="text-[10px]">
                cached
              </Badge>
            )}
          </div>
          <pre className="text-sm whitespace-pre-wrap p-4 font-mono max-h-96 overflow-auto">
            {block.text}
          </pre>
        </div>
      ))}
    </div>
  );
}
