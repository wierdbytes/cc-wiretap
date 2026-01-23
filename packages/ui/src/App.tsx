import { useMemo } from 'react';
import { useWebSocket, reconnectWebSocket } from '@/hooks/useWebSocket';
import { useHotkeys } from '@/hooks/useHotkeys';
import { Header } from '@/components/layout/Header';
import { RequestList } from '@/components/requests/RequestList';
import { SessionReportView } from '@/components/views/SessionReportView';
import { useAppStore, useSidebarVisible, useConnectionStatus, useRequests } from '@/stores/appStore';
import { formatTokenCount } from '@/lib/utils';

function RequestsPanel() {
  const requestsMap = useRequests();

  const { totalInputTokens, totalOutputTokens } = useMemo(() => {
    let inputTotal = 0;
    let outputTotal = 0;
    for (const request of requestsMap.values()) {
      if (request.response?.type === 'message') {
        const usage = request.response.usage;
        inputTotal += (usage.input_tokens || 0) +
                 (usage.cache_read_input_tokens || 0) +
                 (usage.cache_creation_input_tokens || 0);
        outputTotal += usage.output_tokens || 0;
      }
    }
    return { totalInputTokens: inputTotal, totalOutputTokens: outputTotal };
  }, [requestsMap]);

  return (
    <div className="w-80 flex flex-col border-r border-border">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold">Requests</h2>
        {(totalInputTokens > 0 || totalOutputTokens > 0) && (
          <span className="text-xs text-muted-foreground" title="Total tokens (input / output)">
            ↑ {formatTokenCount(totalInputTokens)} ↓ {formatTokenCount(totalOutputTokens)}
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <RequestList />
      </div>
    </div>
  );
}

function App() {
  useWebSocket();
  const sidebarVisible = useSidebarVisible();
  const connectionStatus = useConnectionStatus();
  const canReconnect = connectionStatus === 'disconnected' || connectionStatus === 'error';

  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const triggerCollapseAll = useAppStore((s) => s.triggerCollapseAll);
  const triggerExpandAll = useAppStore((s) => s.triggerExpandAll);
  const selectLastRequest = useAppStore((s) => s.selectLastRequest);
  const triggerToggleSystemPrompt = useAppStore((s) => s.triggerToggleSystemPrompt);
  const triggerToggleTools = useAppStore((s) => s.triggerToggleTools);
  const triggerToggleMessages = useAppStore((s) => s.triggerToggleMessages);
  const setShowClearDialog = useAppStore((s) => s.setShowClearDialog);
  const setShowHotkeysDialog = useAppStore((s) => s.setShowHotkeysDialog);
  const showClearDialog = useAppStore((s) => s.showClearDialog);
  const showHotkeysDialog = useAppStore((s) => s.showHotkeysDialog);

  const openClearDialog = useMemo(() => () => setShowClearDialog(true), [setShowClearDialog]);
  const openHotkeysDialog = useMemo(() => () => setShowHotkeysDialog(true), [setShowHotkeysDialog]);

  const anyDialogOpen = showClearDialog || showHotkeysDialog;

  const hotkeys = useMemo(
    () => anyDialogOpen ? [] : [
      { code: 'KeyS', action: toggleSidebar, description: 'Toggle sidebar' },
      { code: 'KeyF', action: triggerCollapseAll, description: 'Fold all' },
      { code: 'KeyE', action: triggerExpandAll, description: 'Expand all' },
      { code: 'Space', action: selectLastRequest, description: 'Select last message' },
      { code: 'Digit1', action: triggerToggleSystemPrompt, description: 'Toggle system prompt' },
      { code: 'Digit2', action: triggerToggleTools, description: 'Toggle tools' },
      { code: 'Digit3', action: triggerToggleMessages, description: 'Toggle messages' },
      { code: 'KeyX', action: openClearDialog, description: 'Clear all' },
      { key: '?', action: openHotkeysDialog, description: 'Show help' },
      ...(canReconnect ? [{ code: 'KeyR', action: reconnectWebSocket, description: 'Reconnect' }] : []),
    ],
    [toggleSidebar, triggerCollapseAll, triggerExpandAll, selectLastRequest, triggerToggleSystemPrompt, triggerToggleTools, triggerToggleMessages, openClearDialog, openHotkeysDialog, anyDialogOpen, canReconnect]
  );

  useHotkeys(hotkeys);

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1 flex min-h-0">
        {sidebarVisible && <RequestsPanel />}
        <main className="flex-1 min-h-0 min-w-0 overflow-hidden">
          <SessionReportView />
        </main>
      </div>
    </div>
  );
}

export default App;
