import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatTokenCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + '...';
}

export function extractModelName(model: string): string {
  const tiers = ['opus', 'sonnet', 'haiku'];
  const lower = model.toLowerCase();

  const tier = tiers.find((t) => lower.includes(t));
  if (!tier) {
    const parts = model.split('-');
    return parts.length >= 2 ? parts.slice(0, 2).join('-') : model;
  }

  const label = tier.charAt(0).toUpperCase() + tier.slice(1);

  // Strip date suffix (YYYYMMDD) before parsing version
  const base = lower.replace(/-?\d{8}$/, '');

  // New format: {tier}-{major}[-{minor}] e.g. "opus-4-6", "sonnet-4-5"
  const newFmt = base.match(new RegExp(`${tier}-(\\d+)(?:-(\\d+))?`));
  if (newFmt) {
    const [, major, minor] = newFmt;
    return minor && minor !== '0' ? `${label} ${major}.${minor}` : `${label} ${major}`;
  }

  // Old format: {major}[-{minor}]-{tier} e.g. "3-5-sonnet", "3-opus"
  const oldFmt = base.match(new RegExp(`(\\d+)(?:-(\\d+))?-${tier}`));
  if (oldFmt) {
    const [, major, minor] = oldFmt;
    return minor ? `${label} ${major}.${minor}` : `${label} ${major}`;
  }

  return label;
}
