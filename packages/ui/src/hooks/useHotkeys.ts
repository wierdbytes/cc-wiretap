import { useEffect } from 'react';

type HotkeyConfig = {
  code: string;
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

      const hotkey = hotkeys.find((h) => h.code === e.code);
      if (hotkey) {
        e.preventDefault();
        hotkey.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hotkeys]);
}
