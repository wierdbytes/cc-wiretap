import { create } from 'zustand';
import type {
  Session,
  Request,
  ConnectionStatus,
  WSMessage,
} from '@/lib/types';

export type ViewMode = 'tree' | 'flat' | 'report';

interface AppState {
  // Connection
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;

  // View Mode
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Sidebar
  sidebarVisible: boolean;
  setSidebarVisible: (visible: boolean) => void;
  toggleSidebar: () => void;

  // Report expand/collapse triggers
  reportExpandTrigger: number;
  reportCollapseTrigger: number;
  triggerExpandAll: () => void;
  triggerCollapseAll: () => void;

  // Sessions
  sessions: Map<string, Session>;
  selectedSessionId: string | null;
  selectSession: (sessionId: string | null) => void;

  // Requests
  requests: Map<string, Request>;
  selectedRequestId: string | null;
  selectRequest: (requestId: string | null) => void;

  // Actions
  handleMessage: (message: WSMessage) => void;
  clearAll: () => void;

  // Computed getters
  getSessionRequests: (sessionId: string) => Request[];
  getSelectedRequest: () => Request | null;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Connection
  connectionStatus: 'disconnected',
  setConnectionStatus: (status) => set({ connectionStatus: status }),

  // View Mode
  viewMode: 'tree',
  setViewMode: (mode) => set({ viewMode: mode }),

  // Sidebar
  sidebarVisible: true,
  setSidebarVisible: (visible) => set({ sidebarVisible: visible }),
  toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),

  // Report expand/collapse triggers
  reportExpandTrigger: 0,
  reportCollapseTrigger: 0,
  triggerExpandAll: () => set((state) => ({ reportExpandTrigger: state.reportExpandTrigger + 1 })),
  triggerCollapseAll: () => set((state) => ({ reportCollapseTrigger: state.reportCollapseTrigger + 1 })),

  // Sessions
  sessions: new Map(),
  selectedSessionId: null,
  selectSession: (sessionId) => set({ selectedSessionId: sessionId, selectedRequestId: null }),

  // Requests
  requests: new Map(),
  selectedRequestId: null,
  selectRequest: (requestId) => set({ selectedRequestId: requestId }),

  // Actions
  handleMessage: (message) => {
    const state = get();

    switch (message.type) {
      case 'session_start': {
        const newSessions = new Map(state.sessions);
        newSessions.set(message.sessionId, {
          id: message.sessionId,
          startTime: message.timestamp,
          requestCount: 0,
        });
        set({ sessions: newSessions });

        // Auto-select first session
        if (!state.selectedSessionId) {
          set({ selectedSessionId: message.sessionId });
        }
        break;
      }

      case 'request_start': {
        const newRequests = new Map(state.requests);
        newRequests.set(message.requestId, {
          id: message.requestId,
          sessionId: message.sessionId,
          timestamp: message.timestamp,
          method: message.method,
          url: message.url,
          requestHeaders: message.headers,
          sseEvents: [],
          isStreaming: true,
        });
        set({ requests: newRequests });

        // Update session request count
        const newSessions = new Map(state.sessions);
        const session = newSessions.get(message.sessionId);
        if (session) {
          session.requestCount++;
          set({ sessions: newSessions });
        }

        // Auto-select the request if this is the selected session
        if (state.selectedSessionId === message.sessionId) {
          set({ selectedRequestId: message.requestId });
        }
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
    }
  },

  clearAll: () => {
    set({
      sessions: new Map(),
      requests: new Map(),
      selectedSessionId: null,
      selectedRequestId: null,
    });
  },

  // Computed getters
  getSessionRequests: (sessionId) => {
    const state = get();
    const requests: Request[] = [];
    for (const request of state.requests.values()) {
      if (request.sessionId === sessionId) {
        requests.push(request);
      }
    }
    return requests.sort((a, b) => b.timestamp - a.timestamp);
  },

  getSelectedRequest: () => {
    const state = get();
    if (!state.selectedRequestId) return null;
    return state.requests.get(state.selectedRequestId) || null;
  },
}));

// Selectors for performance optimization
export const useConnectionStatus = () => useAppStore((state) => state.connectionStatus);
export const useViewMode = () => useAppStore((state) => state.viewMode);
export const useSidebarVisible = () => useAppStore((state) => state.sidebarVisible);
export const useReportExpandTrigger = () => useAppStore((state) => state.reportExpandTrigger);
export const useReportCollapseTrigger = () => useAppStore((state) => state.reportCollapseTrigger);
export const useSessions = () => useAppStore((state) => state.sessions);
export const useSelectedSessionId = () => useAppStore((state) => state.selectedSessionId);
export const useSelectedRequestId = () => useAppStore((state) => state.selectedRequestId);
export const useRequests = () => useAppStore((state) => state.requests);
export const useSelectedRequest = () => {
  const requests = useAppStore((state) => state.requests);
  const selectedRequestId = useAppStore((state) => state.selectedRequestId);
  if (!selectedRequestId) return null;
  return requests.get(selectedRequestId) || null;
};
