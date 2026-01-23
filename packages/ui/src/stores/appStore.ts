import { create } from 'zustand';
import type {
  Request,
  ConnectionStatus,
  WSMessage,
} from '@/lib/types';

interface AppState {
  // Connection
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;

  // Clear confirmation dialog
  showClearDialog: boolean;
  setShowClearDialog: (show: boolean) => void;

  // Hotkeys help dialog
  showHotkeysDialog: boolean;
  setShowHotkeysDialog: (show: boolean) => void;

  // Sidebar
  sidebarVisible: boolean;
  setSidebarVisible: (visible: boolean) => void;
  toggleSidebar: () => void;

  // Expand/collapse triggers
  reportExpandTrigger: number;
  reportCollapseTrigger: number;
  systemPromptToggleTrigger: number;
  toolsToggleTrigger: number;
  messagesToggleTrigger: number;
  triggerExpandAll: () => void;
  triggerCollapseAll: () => void;
  triggerToggleSystemPrompt: () => void;
  triggerToggleTools: () => void;
  triggerToggleMessages: () => void;

  // Requests
  requests: Map<string, Request>;
  selectedRequestId: string | null;
  selectRequest: (requestId: string | null) => void;
  selectLastRequest: () => void;

  // Actions
  handleMessage: (message: WSMessage) => void;
  clearAll: () => void;

  // Computed getters
  getSelectedRequest: () => Request | null;
  getAllRequests: () => Request[];
}

export const useAppStore = create<AppState>((set, get) => ({
  // Connection
  connectionStatus: 'disconnected',
  setConnectionStatus: (status) => set({ connectionStatus: status }),

  // Clear confirmation dialog
  showClearDialog: false,
  setShowClearDialog: (show) => set({ showClearDialog: show }),

  // Hotkeys help dialog
  showHotkeysDialog: false,
  setShowHotkeysDialog: (show) => set({ showHotkeysDialog: show }),

  // Sidebar
  sidebarVisible: true,
  setSidebarVisible: (visible) => set({ sidebarVisible: visible }),
  toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),

  // Expand/collapse triggers
  reportExpandTrigger: 0,
  reportCollapseTrigger: 0,
  systemPromptToggleTrigger: 0,
  toolsToggleTrigger: 0,
  messagesToggleTrigger: 0,
  triggerExpandAll: () => set((state) => ({ reportExpandTrigger: state.reportExpandTrigger + 1 })),
  triggerCollapseAll: () => set((state) => ({ reportCollapseTrigger: state.reportCollapseTrigger + 1 })),
  triggerToggleSystemPrompt: () => set((state) => ({ systemPromptToggleTrigger: state.systemPromptToggleTrigger + 1 })),
  triggerToggleTools: () => set((state) => ({ toolsToggleTrigger: state.toolsToggleTrigger + 1 })),
  triggerToggleMessages: () => set((state) => ({ messagesToggleTrigger: state.messagesToggleTrigger + 1 })),

  // Requests
  requests: new Map(),
  selectedRequestId: null,
  selectRequest: (requestId) => set({ selectedRequestId: requestId }),
  selectLastRequest: () => {
    const { requests } = get();
    if (requests.size === 0) return;

    const sorted = [...requests.values()].sort(
      (a, b) => b.timestamp - a.timestamp
    );
    if (sorted.length > 0) {
      set({ selectedRequestId: sorted[0].id });
    }
  },

  // Actions
  handleMessage: (message) => {
    const state = get();

    switch (message.type) {
      case 'request_start': {
        const newRequests = new Map(state.requests);
        newRequests.set(message.requestId, {
          id: message.requestId,
          timestamp: message.timestamp,
          method: message.method,
          url: message.url,
          requestHeaders: message.headers,
          sseEvents: [],
          isStreaming: true,
        });
        set({ requests: newRequests });
        break;
      }

      case 'request_body': {
        const newRequests = new Map(state.requests);
        const request = newRequests.get(message.requestId);
        if (request) {
          request.requestBody = message.body;
          set({ requests: newRequests });
        }
        break;
      }

      case 'response_start': {
        const newRequests = new Map(state.requests);
        const request = newRequests.get(message.requestId);
        if (request) {
          request.statusCode = message.statusCode;
          request.responseHeaders = message.headers;
          set({ requests: newRequests });
        }
        break;
      }

      case 'response_chunk': {
        const newRequests = new Map(state.requests);
        const request = newRequests.get(message.requestId);
        if (request) {
          request.sseEvents.push(message.event);
          set({ requests: newRequests });
        }
        break;
      }

      case 'response_complete': {
        const newRequests = new Map(state.requests);
        const request = newRequests.get(message.requestId);
        if (request) {
          request.response = message.response;
          request.durationMs = message.durationMs;
          request.isStreaming = false;
          set({ requests: newRequests });
        }
        break;
      }

      case 'error': {
        if (message.requestId) {
          const newRequests = new Map(state.requests);
          const request = newRequests.get(message.requestId);
          if (request) {
            request.error = message.error;
            request.isStreaming = false;
            set({ requests: newRequests });
          }
        }
        break;
      }

      case 'clear_all': {
        set({
          requests: new Map(),
          selectedRequestId: null,
        });
        break;
      }
    }
  },

  clearAll: () => {
    set({
      requests: new Map(),
      selectedRequestId: null,
    });
  },

  // Computed getters
  getSelectedRequest: () => {
    const state = get();
    if (!state.selectedRequestId) return null;
    return state.requests.get(state.selectedRequestId) || null;
  },

  getAllRequests: () => {
    const state = get();
    const requests: Request[] = [];
    for (const request of state.requests.values()) {
      requests.push(request);
    }
    return requests.sort((a, b) => b.timestamp - a.timestamp);
  },
}));

// Selectors for performance optimization
export const useConnectionStatus = () => useAppStore((state) => state.connectionStatus);
export const useShowClearDialog = () => useAppStore((state) => state.showClearDialog);
export const useShowHotkeysDialog = () => useAppStore((state) => state.showHotkeysDialog);
export const useSidebarVisible = () => useAppStore((state) => state.sidebarVisible);
export const useReportExpandTrigger = () => useAppStore((state) => state.reportExpandTrigger);
export const useReportCollapseTrigger = () => useAppStore((state) => state.reportCollapseTrigger);
export const useSystemPromptToggleTrigger = () => useAppStore((state) => state.systemPromptToggleTrigger);
export const useToolsToggleTrigger = () => useAppStore((state) => state.toolsToggleTrigger);
export const useMessagesToggleTrigger = () => useAppStore((state) => state.messagesToggleTrigger);
export const useSelectedRequestId = () => useAppStore((state) => state.selectedRequestId);
export const useRequests = () => useAppStore((state) => state.requests);
export const useSelectedRequest = () => {
  const requests = useAppStore((state) => state.requests);
  const selectedRequestId = useAppStore((state) => state.selectedRequestId);
  if (!selectedRequestId) return null;
  return requests.get(selectedRequestId) || null;
};
