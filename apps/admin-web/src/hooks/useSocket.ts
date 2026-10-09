import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

export type SocketStatus = 'connected' | 'connecting' | 'reconnecting' | 'offline';

export interface AnalyticsUpdatePayload {
  timestamp: string;
  eventType: 'AGGREGATE_REFRESH' | 'REGIONAL_ALERT' | 'THRESHOLD_UPDATE';
  summaryMessage: string;
  affectedRegions?: string[];
  aggregateDelta?: {
    category: string;
    casesCount?: number;
    suppressed?: boolean;
  };
}

export function useSocket(onAnalyticsUpdate?: (payload: AnalyticsUpdatePayload) => void) {
  const { isAuthenticated, getAuthHeader } = useAuth();
  const [status, setStatus] = useState<SocketStatus>('offline');
  const [lastEvent, setLastEvent] = useState<AnalyticsUpdatePayload | null>(null);
  const [lastEventTime, setLastEventTime] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const connectSocket = useCallback(() => {
    if (!isAuthenticated) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setStatus('offline');
      return;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

    if (socketRef.current?.connected) {
      return;
    }

    setStatus('connecting');

    const socket = io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      auth: getAuthHeader(),
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('connected');
    });

    socket.on('disconnect', (reason) => {
      if (reason === 'io client disconnect') {
        setStatus('offline');
      } else {
        setStatus('reconnecting');
      }
    });

    socket.on('connect_error', () => {
      setStatus('reconnecting');
    });

    socket.on('analytics:update', (payload: unknown) => {
      // Validate payload for privacy safety: reject patient-level fields if present
      if (!payload || typeof payload !== 'object') return;
      const data = payload as Record<string, unknown>;

      // Privacy Check: Ensure payload contains NO patient identifiers or clinical records
      if ('patientId' in data || 'patientName' in data || 'ssn' in data || 'address' in data || 'diagnosis' in data) {
        console.error('SECURITY ALERT: Unsafe real-time payload containing patient-level identifiers rejected by frontend guard.', data);
        return;
      }

      const validPayload: AnalyticsUpdatePayload = {
        timestamp: String(data.timestamp || new Date().toISOString()),
        eventType: (data.eventType as AnalyticsUpdatePayload['eventType']) || 'AGGREGATE_REFRESH',
        summaryMessage: String(data.summaryMessage || 'Public health aggregate surveillance update received.'),
        affectedRegions: Array.isArray(data.affectedRegions) ? data.affectedRegions.map(String) : undefined,
      };

      setLastEvent(validPayload);
      setLastEventTime(new Date().toLocaleTimeString());
      if (onAnalyticsUpdate) {
        onAnalyticsUpdate(validPayload);
      }
    });

  }, [isAuthenticated, getAuthHeader, onAnalyticsUpdate]);

  useEffect(() => {
    connectSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connectSocket]);

  return {
    status,
    lastEvent,
    lastEventTime,
    reconnect: connectSocket,
  };
}
