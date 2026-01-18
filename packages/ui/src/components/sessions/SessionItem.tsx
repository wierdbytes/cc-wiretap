import { cn } from '@/lib/utils';
import { formatTimestamp } from '@/lib/utils';
import type { Session } from '@/lib/types';

interface SessionItemProps {
  session: Session;
  isSelected: boolean;
  onClick: () => void;
}

export function SessionItem({ session, isSelected, onClick }: SessionItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2 border-b border-sidebar-border transition-colors',
        'hover:bg-sidebar-accent',
        isSelected && 'bg-sidebar-accent'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-mono text-sidebar-foreground">
          {session.id.slice(0, 8)}
        </span>
        <span className="text-xs text-muted-foreground">
          {session.requestCount} req
        </span>
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        {formatTimestamp(session.startTime)}
      </div>
    </button>
  );
}
