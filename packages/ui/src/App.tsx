import { useWebSocket } from '@/hooks/useWebSocket';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { RequestList } from '@/components/requests/RequestList';
import { RequestDetail } from '@/components/requests/RequestDetail';
import { FlatView } from '@/components/views/FlatView';
import { Separator } from '@/components/ui/separator';
import { useViewMode } from '@/stores/appStore';

function TreeLayout() {
  return (
    <>
      <div className="w-80 flex flex-col border-r border-border">
        <div className="p-3 border-b border-border">
          <h2 className="text-sm font-semibold">Requests</h2>
        </div>
        <div className="flex-1 min-h-0">
          <RequestList />
        </div>
      </div>
      <main className="flex-1 min-h-0">
        <RequestDetail />
      </main>
    </>
  );
}

function FlatLayout() {
  return (
    <main className="flex-1 min-h-0 flex">
      <FlatView />
    </main>
  );
}

function App() {
  // Initialize WebSocket connection
  useWebSocket();

  const viewMode = useViewMode();

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <Separator orientation="vertical" />
        {viewMode === 'tree' ? <TreeLayout /> : <FlatLayout />}
      </div>
    </div>
  );
}

export default App;
