"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Headset,
  MessageSquare,
  RefreshCw,
  ThumbsUp,
  TrendingDown,
  Users,
} from "lucide-react";
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Spinner,
  StatCard,
} from "@/components/ui";
import { apiRequest, formatDateTime } from "@/lib/api";

const FAQ_LABELS = {
  hours: "Opening hours",
  location: "Clinic address",
  directions: "Directions",
  parking: "Parking",
  fees: "Consultation fees",
  insurance: "Insurance",
  documents: "What to bring",
  preparation: "Visit preparation",
  "app-help": "App and website help",
  cancellation: "Cancellation policy",
  pharmacy: "Pharmacy and lab",
  accessibility: "Accessibility",
  wifi: "Wi-Fi",
  emergency: "Emergencies",
};

const INTENT_LABELS = {
  book: "Book appointment",
  "booking": "Book appointment",
  reschedule: "Reschedule",
  cancel: "Cancel appointment",
  queue: "Queue status",
  "queue-status": "Queue status",
  walkin: "Walk-in",
  "walk-in": "Walk-in",
  appointments: "My appointments",
  history: "Visit history",
  faq: "Clinic question",
  triage: "Symptom triage",
  intake: "Pre-visit intake",
  handoff: "Human handoff",
  language: "Language change",
  reminders: "Reminders",
  fallback: "Unmatched question",
  llm: "AI fallback",
  greeting: "Greeting",
  thanks: "Thanks",
  bye: "Goodbye",
};

function humanize(value) {
  if (!value) return "Unknown";
  if (FAQ_LABELS[value]) return FAQ_LABELS[value];
  if (INTENT_LABELS[value]) return INTENT_LABELS[value];
  return String(value)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function percent(value) {
  return `${value ?? 0}%`;
}

export default function ChatbotAnalyticsPanel() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest(`/api/chat/analytics?days=${days}`);
      setData(result.analytics);
    } catch (failure) {
      setError(failure.message || "Failed to load chatbot analytics");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const trend = useMemo(() => {
    const items = data?.trend || [];
    return items.slice(-14);
  }, [data]);

  const maxTrend = useMemo(
    () => Math.max(...trend.map((item) => item.conversations), 1),
    [trend]
  );

  if (loading && !data) return <Spinner label="Loading chatbot analytics..." />;

  const overview = data?.overview || {};

  return (
    <div className="space-y-4">
      {error ? (
        <AlertBanner type="error" onClose={() => setError("")}>
          {error}
        </AlertBanner>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">Chatbot performance</h2>
          <p className="text-sm text-slate-500">
            Metadata only — message content stays encrypted and is never shown here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <Button variant="secondary" size="sm" onClick={load} loading={loading}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Conversations"
          value={overview.conversations ?? 0}
          hint={`${overview.messages ?? 0} messages`}
          icon={MessageSquare}
          tone="blue"
        />
        <StatCard
          label="Resolved"
          value={overview.resolved ?? 0}
          hint={`${overview.open ?? 0} still open`}
          icon={Users}
          tone="green"
        />
        <StatCard
          label="Handoff rate"
          value={percent(overview.handoffRate)}
          hint={`${overview.escalated ?? 0} escalated`}
          icon={Headset}
          tone="amber"
        />
        <StatCard
          label="Satisfaction"
          value={
            overview.satisfaction === null || overview.satisfaction === undefined
              ? "—"
              : percent(overview.satisfaction)
          }
          hint={`${overview.positiveFeedback ?? 0} up · ${overview.negativeFeedback ?? 0} down`}
          icon={ThumbsUp}
          tone="violet"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Common questions"
            subtitle="Grounded clinic topics the assistant answered most."
          />
          <div className="px-5 pb-5 space-y-2">
            {(data?.commonQuestions || []).length === 0 ? (
              <p className="text-sm text-slate-500">No questions in this range yet.</p>
            ) : (
              data.commonQuestions.map((item) => {
                const max = Math.max(
                  ...data.commonQuestions.map((entry) => entry.count),
                  1
                );
                return (
                  <div key={item.faqKey} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 truncate text-xs font-semibold text-slate-600">
                      {humanize(item.faqKey)}
                    </span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${(item.count / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs font-bold text-slate-700">
                      {item.count}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Top intents"
            subtitle="What patients tried to do in chat."
          />
          <div className="px-5 pb-5 space-y-2">
            {(data?.intents || []).length === 0 ? (
              <p className="text-sm text-slate-500">No intents recorded yet.</p>
            ) : (
              data.intents.slice(0, 10).map((item) => {
                const max = Math.max(
                  ...data.intents.slice(0, 10).map((entry) => entry.count),
                  1
                );
                return (
                  <div key={item.intent} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 truncate text-xs font-semibold text-slate-600">
                      {humanize(item.intent)}
                    </span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${(item.count / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs font-bold text-slate-700">
                      {item.count}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Unresolved" subtitle="Where patients needed more help." />
          <div className="px-5 pb-5 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Unmatched questions</span>
              <Badge tone="amber">{data?.unresolved?.fallbacks ?? 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Human handoffs</span>
              <Badge tone="violet">{data?.unresolved?.handoffs ?? 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Negative feedback</span>
              <Badge tone="red">{data?.unresolved?.negativeFeedback ?? 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Open conversations</span>
              <Badge tone="blue">{data?.unresolved?.openConversations ?? 0}</Badge>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Drop-off points" subtitle="Last intent before a chat went quiet." />
          <div className="px-5 pb-5 space-y-2">
            {(data?.dropOff || []).length === 0 ? (
              <p className="text-sm text-slate-500">No drop-offs recorded.</p>
            ) : (
              data.dropOff.map((item) => (
                <div
                  key={item.lastIntent}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
                    {humanize(item.lastIntent)}
                  </span>
                  <span className="font-bold text-slate-700">{item.count}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Channels and languages" subtitle="Where chats come from." />
          <div className="px-5 pb-5 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {(data?.channels || []).map((item) => (
                <Badge key={item.channel} tone="blue">
                  {item.channel}: {item.count}
                </Badge>
              ))}
              {(data?.channels || []).length === 0 ? (
                <span className="text-sm text-slate-500">No chats yet.</span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(data?.languages || []).map((item) => (
                <Badge key={item.locale} tone="slate">
                  {item.locale.toUpperCase()}: {item.count}
                </Badge>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Conversation trend" subtitle="Daily volume in this range." />
        <div className="px-5 pb-5">
          {trend.length === 0 ? (
            <p className="text-sm text-slate-500">No conversations in this range.</p>
          ) : (
            <div className="flex h-32 items-end gap-1.5">
              {trend.map((item) => (
                <div
                  key={item.date}
                  className="group flex flex-1 flex-col items-center justify-end gap-1"
                  title={`${item.date}: ${item.conversations} conversations, ${item.handoffs} handoffs`}
                >
                  <div
                    className="w-full rounded-t-md bg-blue-500/80 transition group-hover:bg-blue-600"
                    style={{
                      height: `${Math.max((item.conversations / maxTrend) * 100, 4)}%`,
                    }}
                  />
                  <span className="text-[9px] text-slate-400">
                    {item.date?.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Recent conversations"
          subtitle="Metadata for the latest chats. Open the handoff panel for active ones."
        />
        {(data?.recent || []).length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No conversations yet"
            description="Start a chat from the website widget to see analytics here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Patient</th>
                  <th className="px-5 py-3 font-semibold">Channel</th>
                  <th className="px-5 py-3 font-semibold">Language</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Messages</th>
                  <th className="px-5 py-3 font-semibold">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recent.map((item) => (
                  <tr key={item._id}>
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {item.user?.name || "Guest"}
                    </td>
                    <td className="px-5 py-3 capitalize text-slate-600">
                      {item.channel}
                    </td>
                    <td className="px-5 py-3 uppercase text-slate-600">
                      {item.locale}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{item.status}</td>
                    <td className="px-5 py-3 text-slate-600">{item.messageCount}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {formatDateTime(item.lastMessageAt || item.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
