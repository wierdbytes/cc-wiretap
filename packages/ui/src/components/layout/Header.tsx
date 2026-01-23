import { Radio, Trash2, List, MessageSquare, FileText, PanelLeftClose, PanelLeft, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useConnectionStatus, useViewMode, useSidebarVisible, useAppStore } from '@/stores/appStore';
import type { ConnectionStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const statusConfig: Record<ConnectionStatus, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  connected: { label: 'Connected', variant: 'success' },
  connecting: { label: 'Connecting...', variant: 'warning' },
  disconnected: { label: 'Disconnected', variant: 'secondary' },
  error: { label: 'Error', variant: 'destructive' },
};

function ViewModeToggle() {
  const viewMode = useViewMode();
  const setViewMode = useAppStore((state) => state.setViewMode);

  return (
    <div className="flex items-center bg-muted rounded-md p-0.5">
      <button
        onClick={() => setViewMode('tree')}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded transition-colors',
          viewMode === 'tree'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <List className="h-3.5 w-3.5" />
        Tree
      </button>
      <button
        onClick={() => setViewMode('flat')}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded transition-colors',
          viewMode === 'flat'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Flat
      </button>
      <button
        onClick={() => setViewMode('report')}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded transition-colors',
          viewMode === 'report'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <FileText className="h-3.5 w-3.5" />
        Report
      </button>
    </div>
  );
}

export function Header() {
  const connectionStatus = useConnectionStatus();
  const viewMode = useViewMode();
  const sidebarVisible = useSidebarVisible();
  const clearAll = useAppStore((state) => state.clearAll);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const triggerExpandAll = useAppStore((state) => state.triggerExpandAll);
  const triggerCollapseAll = useAppStore((state) => state.triggerCollapseAll);
  const { label, variant } = statusConfig[connectionStatus];

  return (
    <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="h-8 w-8"
          title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
        >
          {sidebarVisible ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeft className="h-4 w-4" />
          )}
        </Button>
        <Radio className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold">Claude Wiretap</h1>
        <Badge variant={variant} className="ml-2">
          {label}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <ViewModeToggle />
        {viewMode === 'report' && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={triggerExpandAll}
              className="h-7 w-7"
              title="Expand all"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={triggerCollapseAll}
              className="h-7 w-7"
              title="Collapse all"
            >
              <ChevronsDownUp className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={clearAll}
          className="h-7 w-7"
          title="Clear all"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>
  );
}
