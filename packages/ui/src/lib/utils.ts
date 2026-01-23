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
  // Map model IDs to friendly display names
  const modelLower = model.toLowerCase();

  if (modelLower.includes('opus-4-5') || modelLower.includes('opus-4.5')) {
    return 'Opus 4.5';
  }
  if (modelLower.includes('opus-4') || modelLower.includes('opus4')) {
    return 'Opus 4';
  }
  if (modelLower.includes('sonnet-4') || modelLower.includes('sonnet4')) {
    return 'Sonnet 4';
  }
  if (modelLower.includes('sonnet-3-5') || modelLower.includes('sonnet-3.5')) {
    return 'Sonnet 3.5';
  }
  if (modelLower.includes('sonnet')) {
    return 'Sonnet';
  }
  if (modelLower.includes('haiku-3') || modelLower.includes('haiku3')) {
    return 'Haiku 3';
  }
  if (modelLower.includes('haiku')) {
    return 'Haiku';
  }
  if (modelLower.includes('opus')) {
    return 'Opus';
  }

  // Fallback: extract basic model name
  const parts = model.split('-');
  if (parts.length >= 2) {
    return parts.slice(0, 2).join('-');
  }
  return model;
}
