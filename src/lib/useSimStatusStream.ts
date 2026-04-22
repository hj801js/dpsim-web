"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { SimStatus } from "@/lib/types";

// v1.1.4 SSE stream. Subscribes to `/api/dpsim/simulation/<id>/events`
// (proxied to the Rust API's Rocket EventStream) and feeds status updates
// into react-query under the same ["sim-status", id] key the polling
// client uses — so existing consumers (progress bar, status label) keep
// working without knowing the transport.
//
// Falls back to polling by simply doing nothing if EventSource isn't
// available (older Safari iframe contexts, CSR test harnesses). The
// existing useQuery-based polling continues in that case.
export function useSimStatusStream(id: number) {
  const qc = useQueryClient();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return;
    }
    const url = `/api/dpsim/simulation/${id}/events`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("status", (ev) => {
      const msg = ev as MessageEvent;
      try {
        const parsed = JSON.parse(msg.data) as {
          simulation_id: number;
          status: string;
          payload?: SimStatus | null;
          canceled: boolean;
        };
        // Merge the inner payload with the canonical status field so
        // polling and streaming both land the same shape in react-query.
        const merged: SimStatus = {
          status: (parsed.payload?.status ?? (parsed.status as SimStatus["status"])),
          ...(parsed.payload ?? {}),
        };
        qc.setQueryData<SimStatus>(["sim-status", id], merged);
      } catch {
        // Malformed line — ignore, keep listening.
      }
    });

    es.addEventListener("closed", () => {
      // Terminal state; server closes the connection after this event.
      qc.invalidateQueries({ queryKey: ["simulation", id] });
      es.close();
    });

    es.onerror = () => {
      // Network hiccup or explicit close. The browser will auto-reconnect
      // on transient errors (EventSource retry). On permanent failure the
      // react-query polling path is still running and takes over.
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [id, qc]);
}
