import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import type { WSMessage } from '@/lib/types';

const WS_URL = 'ws://localhost:8081';
const RECONNECT_DELAY = 3000;

// Global reference to WebSocket for sending messages
let globalWsRef: WebSocket | null = null;
// Global reference to connect function for manual reconnection
let globalConnectFn: (() => void) | null = null;
// Global reference to cancel pending reconnect
let globalCancelReconnectFn: (() => void) | null = null;

export function sendWebSocketMessage(message: { type: string; [key: string]: unknown }) {
  if (globalWsRef?.readyState === WebSocket.OPEN) {
    globalWsRef.send(JSON.stringify(message));
  }
}

export function reconnectWebSocket() {
  const status = useAppStore.getState().connectionStatus;
  if (status === 'disconnected' || status === 'error') {
    // Cancel any pending reconnect timeout
    globalCancelReconnectFn?.();
    // Trigger immediate reconnect
    globalConnectFn?.();
  }
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountedRef = useRef(false);

  useEffect(() => {
    isUnmountedRef.current = false;

    const cancelReconnect = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const connect = () => {
      if (isUnmountedRef.current) return;
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

      // Close existing socket if in weird state
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        globalWsRef = null;
      }

      useAppStore.getState().setConnectionStatus('connecting');

      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        globalWsRef = ws;

        ws.onopen = () => {
          if (isUnmountedRef.current) return;
          useAppStore.getState().setConnectionStatus('connected');
          console.log('[WebSocket] Connected to proxy');
        };

        ws.onmessage = (event) => {
          if (isUnmountedRef.current) return;
          try {
            const message = JSON.parse(event.data) as WSMessage;
            useAppStore.getState().handleMessage(message);
          } catch (error) {
            console.error('[WebSocket] Failed to parse message:', error);
          }
        };

        ws.onclose = () => {
          if (isUnmountedRef.current) return;
          useAppStore.getState().setConnectionStatus('disconnected');
          console.log('[WebSocket] Disconnected, reconnecting in', RECONNECT_DELAY, 'ms...');
          scheduleReconnect();
        };

        ws.onerror = (error) => {
          if (isUnmountedRef.current) return;
          useAppStore.getState().setConnectionStatus('error');
          console.error('[WebSocket] Error:', error);
        };
      } catch (error) {
        if (isUnmountedRef.current) return;
        useAppStore.getState().setConnectionStatus('error');
        console.error('[WebSocket] Failed to connect:', error);
        scheduleReconnect();
      }
    };

    const scheduleReconnect = () => {
      if (isUnmountedRef.current) return;
      cancelReconnect();
      reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_DELAY);
    };

    // Expose functions globally for manual reconnection
    globalConnectFn = connect;
    globalCancelReconnectFn = cancelReconnect;

    connect();

    return () => {
      isUnmountedRef.current = true;
      globalConnectFn = null;
      globalCancelReconnectFn = null;
      cancelReconnect();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        globalWsRef = null;
      }
    };
  }, []);
}
