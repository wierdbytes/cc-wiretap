import { useMemo } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useHotkeys } from '@/hooks/useHotkeys';
import { Header } from '@/components/layout/Header';
import { RequestList } from '@/components/requests/RequestList';
import { SessionReportView } from '@/components/views/SessionReportView';
import { useAppStore, useSidebarVisible } from '@/stores/appStore';

function RequestsPanel() {
  return (
    <div className="w-80 flex flex-col border-r border-border">
      <div className="p-3 border-b border-border">
        <h2 className="text-sm font-semibold">Requests</h2>
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

  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const triggerCollapseAll = useAppStore((s) => s.triggerCollapseAll);
  const triggerExpandAll = useAppStore((s) => s.triggerExpandAll);
  const selectLastRequest = useAppStore((s) => s.selectLastRequest);
  const triggerToggleSystemPrompt = useAppStore((s) => s.triggerToggleSystemPrompt);
  const triggerToggleTools = useAppStore((s) => s.triggerToggleTools);

  const hotkeys = useMemo(
    () => [
      { code: 'KeyS', action: toggleSidebar, description: 'Toggle sidebar' },
      { code: 'KeyF', action: triggerCollapseAll, description: 'Fold all' },
      { code: 'KeyE', action: triggerExpandAll, description: 'Expand all' },
      { code: 'Space', action: selectLastRequest, description: 'Select last message' },
      { code: 'Digit1', action: triggerToggleSystemPrompt, description: 'Toggle system prompt' },
      { code: 'Digit2', action: triggerToggleTools, description: 'Toggle tools' },
    ],
    [toggleSidebar, triggerCollapseAll, triggerExpandAll, selectLastRequest, triggerToggleSystemPrompt, triggerToggleTools]
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
