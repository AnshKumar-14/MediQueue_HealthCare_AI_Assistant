"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { apiRequest, formatDateTime } from "@/lib/api";
import { useQueueEvents } from "@/lib/useQueue";

const TYPE_LABELS = {
  "booking-confirmation": "Booking",
  reminder: "Reminder",
  "medication-reminder": "Medication",
  "follow-up": "Follow-up",
  "turn-near": "Almost your turn",
  "your-turn": "Your turn",
  cancellation: "Cancellation",
  "queue-update": "Queue update",
  intake: "Pre-visit intake",
  "chat-handoff": "Assistant handoff",
  account: "Account",
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest("/api/notifications?limit=30");
      setItems(data.notifications || []);
      setUnread(data.unread || 0);
    } catch {
      // Notifications are non-critical; silently ignore transient failures.
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  useQueueEvents(() => load());

  async function markAllRead() {
    setLoading(true);
    try {
      await apiRequest("/api/notifications/read-all", { method: "PATCH" });
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id) {
    try {
      await apiRequest(`/api/notifications/${id}/read`, { method: "PATCH" });
      setItems((prev) =>
        prev.map((item) => (item._id === id ? { ...item, read: true } : item))
      );
      setUnread((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) load();
        }}
        className="relative w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 ? (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div className="absolute right-0 z-40 mt-2 w-[22rem] max-w-[90vw] bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div>
                <p className="text-sm font-bold text-slate-900">Notifications</p>
                <p className="text-xs text-slate-500">{unread} unread</p>
              </div>
              <button
                onClick={markAllRead}
                disabled={loading || unread === 0}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 disabled:text-slate-300"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">
                  No notifications yet.
                </p>
              ) : (
                items.map((item) => (
                  <button
                    key={item._id}
                    onClick={() => markRead(item._id)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 ${
                      item.read ? "" : "bg-blue-50/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {item.title}
                      </p>
                      {!item.read ? (
                        <span className="mt-1 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{item.message}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {TYPE_LABELS[item.type] || item.type} ·{" "}
                      {formatDateTime(item.createdAt)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
