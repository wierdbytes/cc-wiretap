import { useEffect, useCallback } from 'react';

interface HotkeysDialogProps {
  open: boolean;
  onClose: () => void;
}

interface HotkeyItem {
  key: string;
  label: string;
  description: string;
}

const hotkeys: HotkeyItem[] = [
  { key: 'S', label: 'S', description: 'Toggle sidebar' },
  { key: 'F', label: 'F', description: 'Fold all blocks' },
  { key: 'E', label: 'E', description: 'Expand all blocks' },
  { key: 'Space', label: '␣', description: 'Select last request' },
  { key: '1', label: '1', description: 'Toggle system prompt' },
  { key: '2', label: '2', description: 'Toggle tools' },
  { key: '3', label: '3', description: 'Toggle messages' },
  { key: 'X', label: 'X', description: 'Clear all requests' },
  { key: '?', label: '?', description: 'Show this help' },
];

function KeyboardKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center h-7 min-w-[1.75rem] px-1.5 text-xs font-medium bg-zinc-800 border border-zinc-600 rounded-md shadow-[0_2px_0_0_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.1)]">
      {children}
    </kbd>
  );
}

export function HotkeysDialog({ open, onClose }: HotkeysDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [open, onClose]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl p-0 max-w-sm w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-700/50 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-100">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 -mr-1 rounded hover:bg-zinc-800"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-3 space-y-1">
          {hotkeys.map((hotkey) => (
            <div
              key={hotkey.key}
              className="flex items-center justify-between py-2 group"
            >
              <span className="text-sm text-zinc-300 group-hover:text-zinc-100 transition-colors">
                {hotkey.description}
              </span>
              <KeyboardKey>{hotkey.label}</KeyboardKey>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-zinc-700/50 bg-zinc-800/30">
          <p className="text-xs text-zinc-500 text-center">
            Press <KeyboardKey>Esc</KeyboardKey> to close
          </p>
        </div>
      </div>
    </div>
  );
}
