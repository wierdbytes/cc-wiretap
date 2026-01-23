import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSelectedRequestId, useRequests, useAppStore } from '@/stores/appStore';
import { RequestItem } from './RequestItem';
import type { Request } from '@/lib/types';

export function RequestList() {
  const selectedRequestId = useSelectedRequestId();
  const requestsMap = useRequests();
  const selectRequest = useAppStore((state) => state.selectRequest);

  const requests = useMemo(() => {
    const all: Request[] = [];
    for (const request of requestsMap.values()) {
      all.push(request);
    }
    return all.sort((a, b) => b.timestamp - a.timestamp);
  }, [requestsMap]);

  if (requests.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        No requests yet
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
