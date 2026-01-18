import { ScrollArea } from '@/components/ui/scroll-area';
import { FlatRequestCard } from './FlatRequestCard';
import { useAppStore, useSelectedSessionId } from '@/stores/appStore';

export function FlatView() {
  const selectedSessionId = useSelectedSessionId();
  const getSessionRequests = useAppStore((state) => state.getSessionRequests);

  if (!selectedSessionId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Select a session to view requests
      </div>
    );
  }

  const sessionRequests = getSessionRequests(selectedSessionId);

  if (sessionRequests.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        No requests in this session
      </div>
    );
  }

  // Sort by timestamp ascending (oldest first) for chronological reading
  const sortedRequests = [...sessionRequests].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Session Requests
          </h2>
          <span className="text-sm text-muted-foreground">
            {sessionRequests.length} request{sessionRequests.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="space-y-4">
          {sortedRequests.map((request) => (
            <FlatRequestCard key={request.id} request={request} />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
