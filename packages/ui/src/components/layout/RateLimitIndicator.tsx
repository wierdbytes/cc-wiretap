import { useState, useEffect } from 'react';
import { useRateLimitInfo } from '@/stores/appStore';

function formatTimeRemaining(resetTimestamp: number): string {
  const now = Date.now() / 1000;
  const remaining = resetTimestamp - now;

  if (remaining <= 0) return '0m';

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);

  if (days > 0) {
    return `${days}d${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h${minutes}m`;
  }
  return `${minutes}m`;
}

interface ProgressBarProps {
  label: string;
  utilization: number;
}

function ProgressBar({ label, utilization }: ProgressBarProps) {
  const percentage = Math.round(utilization * 100);

  return (
    <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
      <span className="text-foreground/70">{label}:</span>
      <span className="text-muted-foreground/50">[</span>
      <div className="relative w-20 h-3 bg-muted/30 rounded-sm overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-slate-500"
          style={{ width: `${utilization * 100}%` }}
        />
      </div>
      <span className="text-muted-foreground/50">]</span>
      <span className="w-8 text-right text-foreground/70">{percentage}%</span>
    </div>
  );
}

export function RateLimitIndicator() {
  const rateLimitInfo = useRateLimitInfo();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!rateLimitInfo) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 60000);

    return () => clearInterval(interval);
  }, [rateLimitInfo]);

  if (!rateLimitInfo) {
    return null;
  }

  return (
    <div className="hidden lg:flex items-center gap-4">
      {rateLimitInfo.fiveHour && (
        <ProgressBar
          label={formatTimeRemaining(rateLimitInfo.fiveHour.resetTimestamp)}
          utilization={rateLimitInfo.fiveHour.utilization}
        />
      )}
      {rateLimitInfo.sevenDay && (
        <ProgressBar
          label={formatTimeRemaining(rateLimitInfo.sevenDay.resetTimestamp)}
          utilization={rateLimitInfo.sevenDay.utilization}
        />
      )}
    </div>
  );
}
