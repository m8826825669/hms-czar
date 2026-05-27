"use client";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";

export interface QueueEvent {
  type: "CONNECTED" | "TOKEN_CREATED" | "TOKEN_UPDATED" | "TOKEN_DELETED";
  token?: {
    id: number;
    token_no: string;
    status: string;
    [key: string]: unknown;
  };
  hospital_id?: number;
  doctor_id?: number | null;
  ts?: string;
}

interface UseQueueSocketOptions {
  hospitalId?: number;
  doctorId?: number | null;
  onEvent?: (e: QueueEvent) => void;
  enabled?: boolean;
}

/**
 * Subscribes to live OPD queue events via WebSocket.
 *
 * Connects to:  ws://<backend>/ws/queue/<hospital_id>/?doctor=<doctor_id>
 *
 * Auto-reconnects on close (3s backoff). No-op when disabled or no hospitalId.
 */
export function useQueueSocket({
  hospitalId,
  doctorId = null,
  onEvent,
  enabled = true,
}: UseQueueSocketOptions) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<QueueEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);

  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!enabled || !hospitalId) return;

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
      const wsBase = backendBase.replace(/^http/, "ws");
      const params = new URLSearchParams();
      if (doctorId) params.set("doctor", String(doctorId));
      const url = `${wsBase}/ws/queue/${hospitalId}/?${params.toString()}`;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) { ws.close(); return; }
        setConnected(true);
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as QueueEvent;
          setLastEvent(data);
          onEventRef.current?.(data);
        } catch (e) {
          // Ignore malformed messages so one bad payload doesn't break
          // the socket — but log so we can spot a broken backend pushing
          // non-JSON onto the channel.
          console.warn("[useQueueSocket] malformed message:", e, ev.data);
        }
      };

      ws.onerror = (ev) => {
        // The browser doesn't expose the actual error here — it's an
        // opaque Event by spec. Log presence so a recurring error is
        // visible; onclose handles the reconnect.
        console.warn("[useQueueSocket] socket error event:", ev);
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (cancelled) return;
        reconnectTimerRef.current = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [hospitalId, doctorId, enabled]);

  return { connected, lastEvent };
}

/** Helper hook: get the current user's hospital ID from auth store. */
export function useCurrentHospitalId(): number | undefined {
  return useAuthStore((s) => (s.user?.hospital_id as number | undefined));
}
