import { useEffect } from 'react';

type HotkeyConfig = {
  code?: string;
  key?: string;
  action: () => void;
  description?: string;
};

export function useHotkeys(hotkeys: HotkeyConfig[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Ignore when any modifier is pressed
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) {
        return;
      }

      const hotkey = hotkeys.find((h) =>
        (h.code && h.code === e.code) || (h.key && h.key === e.key)
      );
      if (hotkey) {
        e.preventDefault();
        hotkey.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hotkeys]);
}
