import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FlatRequestCard } from './FlatRequestCard';
import { useRequests } from '@/stores/appStore';
import type { Request } from '@/lib/types';

export function FlatView() {
  const requestsMap = useRequests();

  const requests = useMemo(() => {
    const all: Request[] = [];
    for (const request of requestsMap.values()) {
      all.push(request);
    }
    // Sort by timestamp ascending (oldest first) for chronological reading
    return all.sort((a, b) => a.timestamp - b.timestamp);
  }, [requestsMap]);

  if (requests.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        No requests yet
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Requests
          </h2>
          <span className="text-sm text-muted-foreground">
            {requests.length} request{requests.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="space-y-4">
          {requests.map((request) => (
            <FlatRequestCard key={request.id} request={request} />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
