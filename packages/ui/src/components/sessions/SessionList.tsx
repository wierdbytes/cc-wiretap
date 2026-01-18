import { useSessions, useSelectedSessionId, useAppStore } from '@/stores/appStore';
import { SessionItem } from './SessionItem';

export function SessionList() {
  const sessionsMap = useSessions();
  const selectedSessionId = useSelectedSessionId();
  const selectSession = useAppStore((state) => state.selectSession);

  if (sessionsMap.size === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No sessions yet.
        <br />
        <span className="text-xs">Start Claude Code with the proxy to begin capturing.</span>
      </div>
    );
  }

  // Sort sessions by start time (newest first)
  const sortedSessions = Array.from(sessionsMap.values()).sort((a, b) => b.startTime - a.startTime);

  return (
    <div>
      {sortedSessions.map((session) => (
        <SessionItem
          key={session.id}
          session={session}
          isSelected={session.id === selectedSessionId}
          onClick={() => selectSession(session.id)}
        />
      ))}
    </div>
  );
}
