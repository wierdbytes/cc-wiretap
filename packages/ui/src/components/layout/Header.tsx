import { useCallback } from 'react';
import { Radio, Trash2, PanelLeftClose, PanelLeft, ChevronsDownUp, ChevronsUpDown, Keyboard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { HotkeysDialog } from '@/components/ui/hotkeys-dialog';
import { RateLimitIndicator } from '@/components/layout/RateLimitIndicator';
import { useConnectionStatus, useSidebarVisible, useShowClearDialog, useShowHotkeysDialog, useAppStore } from '@/stores/appStore';
import { sendWebSocketMessage, reconnectWebSocket } from '@/hooks/useWebSocket';
import type { ConnectionStatus } from '@/lib/types';

const statusConfig: Record<ConnectionStatus, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary'; clickable: boolean }> = {
  connected: { label: 'Connected', variant: 'success', clickable: false },
  connecting: { label: 'Connecting', variant: 'warning', clickable: false },
  disconnected: { label: 'Disconnected', variant: 'secondary', clickable: true },
  error: { label: 'Error', variant: 'destructive', clickable: true },
};

export function Header() {
  const connectionStatus = useConnectionStatus();
  const sidebarVisible = useSidebarVisible();
  const showClearDialog = useShowClearDialog();
  const showHotkeysDialog = useShowHotkeysDialog();
  const setShowClearDialog = useAppStore((state) => state.setShowClearDialog);
  const setShowHotkeysDialog = useAppStore((state) => state.setShowHotkeysDialog);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const triggerExpandAll = useAppStore((state) => state.triggerExpandAll);
  const triggerCollapseAll = useAppStore((state) => state.triggerCollapseAll);
  const { label, variant, clickable } = statusConfig[connectionStatus];
  const isConnecting = connectionStatus === 'connecting';

  const handleReconnect = useCallback(() => {
    if (clickable) {
      reconnectWebSocket();
    }
  }, [clickable]);

  const handleClearConfirm = useCallback(() => {
    sendWebSocketMessage({ type: 'clear_all' });
    setShowClearDialog(false);
  }, [setShowClearDialog]);

  const handleClearCancel = useCallback(() => {
    setShowClearDialog(false);
  }, [setShowClearDialog]);

  const handleClearClick = useCallback(() => {
    setShowClearDialog(true);
  }, [setShowClearDialog]);

  const handleHelpClick = useCallback(() => {
    setShowHotkeysDialog(true);
  }, [setShowHotkeysDialog]);

  const handleHelpClose = useCallback(() => {
    setShowHotkeysDialog(false);
  }, [setShowHotkeysDialog]);

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
        <Badge
          variant={variant}
          className={`ml-2 gap-1.5 ${clickable ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
          onClick={handleReconnect}
          title={clickable ? 'Click to reconnect (R)' : undefined}
        >
          {isConnecting && <Loader2 className="h-3 w-3 animate-spin" />}
          {label}
        </Badge>
      </div>
      <RateLimitIndicator />
      <div className="flex items-center gap-2">
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
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClearClick}
          className="h-7 w-7"
          title="Clear all (X)"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleHelpClick}
          className="h-7 w-7"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="h-3.5 w-3.5" />
        </Button>
      </div>

      <HotkeysDialog
        open={showHotkeysDialog}
        onClose={handleHelpClose}
      />

      <ConfirmDialog
        open={showClearDialog}
        title="Clear All Requests"
        message="Are you sure you want to clear all intercepted requests? This action cannot be undone."
        confirmLabel="Clear All"
        cancelLabel="Cancel"
        onConfirm={handleClearConfirm}
        onCancel={handleClearCancel}
      />
    </header>
  );
}
