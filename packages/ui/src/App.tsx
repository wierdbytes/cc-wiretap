import { useWebSocket } from '@/hooks/useWebSocket';
import { Header } from '@/components/layout/Header';
import { RequestList } from '@/components/requests/RequestList';
import { SessionReportView } from '@/components/views/SessionReportView';
import { useSidebarVisible } from '@/stores/appStore';

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
