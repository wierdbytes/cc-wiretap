import { ScrollArea } from '@/components/ui/scroll-area';
import { SessionList } from '@/components/sessions/SessionList';

export function Sidebar() {
  return (
    <aside className="w-64 border-r border-border bg-sidebar-background flex flex-col">
      <div className="p-3 border-b border-sidebar-border">
        <h2 className="text-sm font-semibold text-sidebar-foreground">Sessions</h2>
      </div>
      <ScrollArea className="flex-1">
        <SessionList />
      </ScrollArea>
    </aside>
  );
}
