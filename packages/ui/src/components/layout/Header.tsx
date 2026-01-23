import { useCallback } from 'react';
import { Trash2, PanelLeftClose, PanelLeft, ChevronsDownUp, ChevronsUpDown, Keyboard, Loader2, Cpu, MessageSquare, Clock, ArrowUp, ArrowDown, BookOpen, PenLine, Database, Wifi, WifiOff, CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { HotkeysDialog } from '@/components/ui/hotkeys-dialog';
import { useConnectionStatus, useSidebarVisible, useShowClearDialog, useShowHotkeysDialog, useAppStore, useSelectedRequest } from '@/stores/appStore';
import { sendWebSocketMessage, reconnectWebSocket } from '@/hooks/useWebSocket';
import { formatDuration, extractModelName, formatTokenCount } from '@/lib/utils';
import type { ConnectionStatus } from '@/lib/types';

const statusConfig: Record<ConnectionStatus, { label: string; color: string; clickable: boolean }> = {
  connected: { label: 'Connected', color: 'text-emerald-500', clickable: false },
  connecting: { label: 'Connecting...', color: 'text-yellow-500', clickable: false },
  disconnected: { label: 'Disconnected - Click to reconnect', color: 'text-muted-foreground', clickable: true },
  error: { label: 'Connection error - Click to reconnect', color: 'text-red-500', clickable: true },
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
  const selectedRequest = useSelectedRequest();
  const { label, color, clickable } = statusConfig[connectionStatus];

  // Extract request info
  const model = selectedRequest?.requestBody?.model || '';
  const msgCount = selectedRequest?.requestBody?.messages?.length || 0;
  const usage = selectedRequest?.response?.type === 'message' ? selectedRequest.response.usage : null;
  const inputTokens = usage?.input_tokens || 0;
  const outputTokens = usage?.output_tokens || 0;
  const cacheReadTokens = usage?.cache_read_input_tokens || 0;
  const cacheCreationTokens = usage?.cache_creation_input_tokens || 0;
  const totalInputTokens = inputTokens + cacheReadTokens + cacheCreationTokens;

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
    <header className="h-12 md:h-14 border-b border-border bg-card px-2 md:px-4 flex items-center justify-between">
      <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="h-6 w-6 md:h-8 md:w-8"
          title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
        >
          {sidebarVisible ? (
            <PanelLeftClose className="h-3.5 w-3.5 md:h-4 md:w-4" />
          ) : (
            <PanelLeft className="h-3.5 w-3.5 md:h-4 md:w-4" />
          )}
        </Button>
        <h1 className="text-sm md:text-lg font-semibold whitespace-nowrap"><span style={{ color: '#DE7356' }}>CC</span> Wiretap</h1>
        <button
          onClick={handleReconnect}
          className={`${color} ${clickable ? 'cursor-pointer hover:opacity-70' : 'cursor-default'} transition-opacity`}
          title={label}
        >
          {connectionStatus === 'connected' && <Wifi className="h-3.5 w-3.5 md:h-4 md:w-4" />}
          {connectionStatus === 'connecting' && <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" />}
          {connectionStatus === 'disconnected' && <WifiOff className="h-3.5 w-3.5 md:h-4 md:w-4" />}
          {connectionStatus === 'error' && <CircleAlert className="h-3.5 w-3.5 md:h-4 md:w-4" />}
        </button>
      </div>

      {selectedRequest && (
        <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono min-w-0 mx-2 overflow-hidden">
          <div className="flex items-center gap-1 text-muted-foreground whitespace-nowrap" title="Model">
            <Cpu className="h-3.5 w-3.5 opacity-60 shrink-0" />
            <span className="text-emerald-400 font-medium">{extractModelName(model)}</span>
          </div>

          <span className="text-muted-foreground/40 mx-1">|</span>

          <div className="flex items-center gap-1 text-muted-foreground" title="Messages">
            <MessageSquare className="h-3.5 w-3.5 opacity-60" />
            <span>{msgCount}</span>
          </div>

          {selectedRequest.durationMs !== undefined && (
            <>
              <span className="text-muted-foreground/40 mx-1">|</span>
              <div className="flex items-center gap-1 text-muted-foreground" title="Duration">
                <Clock className="h-3.5 w-3.5 opacity-60" />
                <span>{formatDuration(selectedRequest.durationMs)}</span>
              </div>
            </>
          )}

          {usage && (
            <>
              <span className="text-muted-foreground/40 mx-1">|</span>
              <div className="flex items-center gap-1 text-blue-400" title="Total input tokens">
                <ArrowUp className="h-3.5 w-3.5" />
                <span>{formatTokenCount(totalInputTokens)}</span>
              </div>

              {(cacheReadTokens > 0 || cacheCreationTokens > 0) && (
                <div className="flex items-center gap-1 text-muted-foreground/60">
                  <span>(</span>
                  {cacheReadTokens > 0 && (
                    <div className="flex items-center gap-0.5 text-green-400" title="Cache read (0.1x cost)">
                      <BookOpen className="h-3 w-3" />
                      <span>{formatTokenCount(cacheReadTokens)}</span>
                    </div>
                  )}
                  {cacheReadTokens > 0 && cacheCreationTokens > 0 && (
                    <span className="text-muted-foreground/40">+</span>
                  )}
                  {cacheCreationTokens > 0 && (
                    <div className="flex items-center gap-0.5 text-orange-400" title="Cache write (1.25x cost)">
                      <PenLine className="h-3 w-3" />
                      <span>{formatTokenCount(cacheCreationTokens)}</span>
                    </div>
                  )}
                  {inputTokens > 0 && (
                    <>
                      <span className="text-muted-foreground/40">+</span>
                      <div className="flex items-center gap-0.5 text-muted-foreground" title="Uncached tokens">
                        <Database className="h-3 w-3" />
                        <span>{formatTokenCount(inputTokens)}</span>
                      </div>
                    </>
                  )}
                  <span>)</span>
                </div>
              )}

              <span className="text-muted-foreground/40 mx-1">|</span>
              <div className="flex items-center gap-1 text-emerald-400" title="Output tokens">
                <ArrowDown className="h-3.5 w-3.5" />
                <span>{formatTokenCount(outputTokens)}</span>
              </div>
            </>
          )}
        </div>
      )}

      <div className="hidden lg:flex items-center gap-2 shrink-0">
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
