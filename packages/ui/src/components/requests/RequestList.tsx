import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSelectedSessionId, useSelectedRequestId, useRequests, useAppStore } from '@/stores/appStore';
import { RequestItem } from './RequestItem';
import type { Request } from '@/lib/types';

export function RequestList() {
  const selectedSessionId = useSelectedSessionId();
  const selectedRequestId = useSelectedRequestId();
  const requestsMap = useRequests();
  const selectRequest = useAppStore((state) => state.selectRequest);

  const requests = useMemo(() => {
    if (!selectedSessionId) return [];
    const filtered: Request[] = [];
    for (const request of requestsMap.values()) {
      if (request.sessionId === selectedSessionId) {
        filtered.push(request);
      }
    }
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }, [requestsMap, selectedSessionId]);

  if (!selectedSessionId) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        Select a session to view requests
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        No requests in this session
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      {requests.map((request) => (
        <RequestItem
          key={request.id}
          request={request}
          isSelected={request.id === selectedRequestId}
          onClick={() => selectRequest(request.id)}
        />
      ))}
    </ScrollArea>
  );
}
