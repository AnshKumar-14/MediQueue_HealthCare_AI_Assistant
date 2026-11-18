"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Headset,
  MessageSquare,
  RefreshCw,
  Send,
} from "lucide-react";
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Modal,
  Spinner,
  StatusBadge,
  inputClass,
} from "@/components/ui";
import { apiRequest, formatDateTime } from "@/lib/api";

const STATUS_OPTIONS = [
  { value: "waiting", label: "Waiting" },
  { value: "handoff-active", label: "Active" },
  { value: "closed", label: "Resolved" },
];

export default function HandoffPanel() {
  const [handoffs, setHandoffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState("waiting");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const threadRef = useRef(null);

  const query =
    status === "waiting"
      ? "/api/chat/handoffs"
      : `/api/chat/handoffs?status=${status}`;

  const loadList = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const data = await apiRequest(query);
        setHandoffs(data.handoffs || []);
        if (!quiet) setError("");
      } catch (failure) {
        if (!quiet) setError(failure.message || "Failed to load chat handoffs");
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [query]
  );

  const loadDetail = useCallback(async (id, quiet = false) => {
    if (!id) return;
    if (!quiet) setDetailLoading(true);
    try {
      const data = await apiRequest(`/api/chat/handoffs/${id}`);
      setDetail(data);
    } catch (failure) {
      if (!quiet) setError(failure.message || "Failed to load the conversation");
    } finally {
      if (!quiet) setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadList(true);
      if (selectedId) loadDetail(selectedId, true);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [loadDetail, loadList, selectedId]);

  useEffect(() => {
    const node = threadRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [detail, detailLoading]);

  function openHandoff(id) {
    setSelectedId(id);
    setDetail(null);
    setReply("");
    loadDetail(id);
  }

  function closeHandoff() {
    setSelectedId(null);
    setDetail(null);
    setReply("");
  }

  async function sendReply(event) {
    event.preventDefault();
    if (!selectedId || !reply.trim()) return;
    setSending(true);
    setError("");
    try {
      await apiRequest(`/api/chat/handoffs/${selectedId}/reply`, {
        method: "POST",
        body: { text: reply.trim() },
      });
      setReply("");
      setNotice("Reply sent to the patient.");
      await loadDetail(selectedId, true);
      await loadList(true);
    } catch (failure) {
      setError(failure.message || "Failed to send the reply");
    } finally {
      setSending(false);
    }
  }

  async function resolveConversation() {
    if (!selectedId) return;
    setResolving(true);
    setError("");
    try {
      await apiRequest(`/api/chat/handoffs/${selectedId}/resolve`, {
        method: "POST",
      });
      setNotice("Conversation resolved and closed.");
      closeHandoff();
      await loadList(true);
    } catch (failure) {
      setError(failure.message || "Failed to resolve the conversation");
    } finally {
      setResolving(false);
    }
  }

  const conversation = detail?.conversation;
  const messages = detail?.messages || [];

  return (
    <div className="space-y-4">
      {error ? (
        <AlertBanner type="error" onClose={() => setError("")}>
          {error}
        </AlertBanner>
      ) : null}
      {notice ? (
        <AlertBanner type="success" onClose={() => setNotice("")}>
          {notice}
        </AlertBanner>
      ) : null}

      <Card>
        <CardHeader
          title="Chat handoffs"
          subtitle="Patients who asked for a human. Open a conversation to read the context and reply."
          action={
            <div className="flex items-center gap-2">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => loadList()}
                loading={loading}
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
            </div>
          }
        />

        {loading && !handoffs.length ? (
          <Spinner label="Loading handoffs..." />
        ) : handoffs.length === 0 ? (
          <EmptyState
            icon={Headset}
            title="No conversations waiting"
            description="When a patient asks to speak with a person, the conversation appears here with its full context."
          />
        ) : (
          <div className="px-4 pb-4 space-y-2">
            {handoffs.map((item) => (
              <button
                key={item.id || item._id}
                type="button"
                onClick={() => openHandoff(item.id || item._id)}
                className="w-full rounded-2xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">
                      {item.user?.name || item.externalId || "Guest patient"}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.user?.phone || item.user?.email || "No contact detail"} ·{" "}
                      <span className="capitalize">{item.channel}</span> ·{" "}
                      {item.locale?.toUpperCase()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={item.status} />
                    <Badge tone="slate">{item.messageCount || 0} messages</Badge>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Last intent: {item.lastIntent || "unknown"} ·{" "}
                  {item.handoff?.requestedAt
                    ? `waiting since ${formatDateTime(item.handoff.requestedAt)}`
                    : `updated ${formatDateTime(item.lastMessageAt)}`}
                </p>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(selectedId)}
        onClose={closeHandoff}
        wide
        title={conversation?.user?.name || "Chat handoff"}
        subtitle={
          conversation
            ? `${conversation.channel} · ${conversation.locale?.toUpperCase()} · ${conversation.status}`
            : "Loading conversation..."
        }
        footer={
          <>
            <Button variant="secondary" onClick={closeHandoff}>
              Close
            </Button>
            <Button
              variant="success"
              onClick={resolveConversation}
              loading={resolving}
              disabled={!conversation}
            >
              <CheckCircle2 className="w-4 h-4" />
              Resolve
            </Button>
          </>
        }
      >
        {detailLoading && !detail ? (
          <Spinner label="Loading conversation..." />
        ) : (
          <div className="space-y-3">
            {conversation?.user ? (
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">Patient context: </span>
                {conversation.user.name}
                {conversation.user.email ? ` · ${conversation.user.email}` : ""}
                {conversation.user.phone ? ` · ${conversation.user.phone}` : ""}
              </div>
            ) : null}

            <div
              ref={threadRef}
              className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 p-3"
            >
              {messages.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  No messages in this conversation yet.
                </p>
              ) : (
                messages.map((message) => {
                  const isUser = message.role === "user";
                  const isStaff = message.role === "staff";
                  return (
                    <div
                      key={message._id}
                      className={`flex ${isUser ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                          isUser
                            ? "border border-slate-200 bg-white text-slate-700"
                            : isStaff
                              ? "bg-emerald-600 text-white"
                              : "bg-blue-600 text-white"
                        }`}
                      >
                        {isStaff ? (
                          <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-emerald-100">
                            Staff
                          </p>
                        ) : null}
                        {message.content}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={sendReply} className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <MessageSquare className="w-3.5 h-3.5" />
                Reply as the reception team
              </label>
              <textarea
                rows={3}
                value={reply}
                onChange={(event) => setReply(event.target.value.slice(0, 1500))}
                placeholder="Write a clear, kind reply. The patient sees it in their chat."
                className={`${inputClass} resize-none`}
              />
              <div className="flex justify-end">
                <Button type="submit" loading={sending} disabled={!reply.trim()}>
                  <Send className="w-4 h-4" />
                  Send reply
                </Button>
              </div>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}
