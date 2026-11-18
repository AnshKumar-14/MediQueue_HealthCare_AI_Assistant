"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { API_URL, apiRequest } from "./api";

/**
 * Loads a doctor's queue and keeps it live with Socket.IO plus a polling
 * fallback (useful if the socket connection drops on a flaky network).
 */
export function useQueue({ doctorId, date, enabled = true } = {}) {
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled && doctorId));
  const [error, setError] = useState("");
  const active = Boolean(enabled && doctorId);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!doctorId) return;
      if (!silent) setLoading(true);

      try {
        const query = `?doctorId=${doctorId}${date ? `&date=${date}` : ""}`;
        const data = await apiRequest(`/api/queue${query}`);
        setQueue(data.queue);
        setError("");
      } catch (err) {
        setError(err.message || "Failed to load the queue");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [doctorId, date]
  );

  useEffect(() => {
    if (!active) {
      setQueue(null);
      return undefined;
    }

    load();
    const timer = setInterval(() => load({ silent: true }), 20000);
    return () => clearInterval(timer);
  }, [active, load]);

  useEffect(() => {
    if (!active) return undefined;

    const socket = io(API_URL, { withCredentials: true });
    socket.emit("join", { doctorId });

    const handler = (payload) => {
      if (!payload?.doctorId || String(payload.doctorId) === String(doctorId)) {
        load({ silent: true });
      }
    };

    socket.on("queue:update", handler);

    return () => {
      socket.off("queue:update", handler);
      socket.disconnect();
    };
  }, [active, doctorId, load]);

  return { queue, loading, error, refresh: () => load() };
}

/**
 * Subscribes to every queue update. The handler is stored in a ref so callers
 * can pass an inline function without reconnecting the socket.
 */
export function useQueueEvents(handler) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const socket = io(API_URL, { withCredentials: true });
    socket.emit("join", {});

    const listener = (payload) => handlerRef.current?.(payload);
    socket.on("queue:update", listener);

    return () => {
      socket.off("queue:update", listener);
      socket.disconnect();
    };
  }, []);
}

export function useDisplayQueue() {
  const [display, setDisplay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiRequest("/api/queue/display");
      setDisplay(data.display);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load the display");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => load({ silent: true }), 20000);
    return () => clearInterval(timer);
  }, [load]);

  useQueueEvents(() => load({ silent: true }));

  return { display, loading, error, refresh: load };
}
