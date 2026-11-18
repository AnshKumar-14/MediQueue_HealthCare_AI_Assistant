"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ClipboardList,
  RefreshCw,
  Save,
  Stethoscope,
} from "lucide-react";
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Modal,
  PriorityBadge,
  Spinner,
  StatusBadge,
  inputClass,
} from "@/components/ui";
import { apiRequest, formatDateTime } from "@/lib/api";

const FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "seen", label: "Seen" },
  { key: "all", label: "All" },
];

function valueOrDash(value) {
  return value && String(value).trim() ? value : "—";
}

export default function IntakePanel({ role = "doctor" }) {
  const [intakes, setIntakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("pending");
  const [busyId, setBusyId] = useState("");
  const [editing, setEditing] = useState(null);
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("normal");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("/api/chat/intakes");
      setIntakes(data.intakes || []);
    } catch (failure) {
      setError(failure.message || "Failed to load pre-visit summaries");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    if (filter === "all") return intakes;
    return intakes.filter((item) => item.status === filter);
  }, [intakes, filter]);

  const counts = useMemo(
    () => ({
      pending: intakes.filter((item) => item.status === "pending").length,
      confirmed: intakes.filter((item) => item.status === "confirmed").length,
      seen: intakes.filter((item) => item.status === "seen").length,
      all: intakes.length,
    }),
    [intakes]
  );

  async function updateIntake(id, patch) {
    setBusyId(id);
    setError("");
    try {
      const data = await apiRequest(`/api/chat/intakes/${id}`, {
        method: "PATCH",
        body: patch,
      });
      setIntakes((previous) =>
        previous.map((item) => (item._id === id ? data.intake : item))
      );
      setNotice("Pre-visit summary updated.");
    } catch (failure) {
      setError(failure.message || "Failed to update the summary");
    } finally {
      setBusyId("");
    }
  }

  function openEditor(intake) {
    setEditing(intake);
    setNotes(intake.staffNotes || "");
    setPriority(intake.suggestedPriority || "normal");
  }

  async function saveEditor(event) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const data = await apiRequest(`/api/chat/intakes/${editing._id}`, {
        method: "PATCH",
        body: {
          staffNotes: notes,
          suggestedPriority: priority,
          status: editing.status === "pending" ? "confirmed" : editing.status,
        },
      });
      setIntakes((previous) =>
        previous.map((item) =>
          item._id === editing._id ? data.intake : item
        )
      );
      setEditing(null);
      setNotice("Notes saved and summary confirmed.");
    } catch (failure) {
      setError(failure.message || "Failed to save notes");
    } finally {
      setSaving(false);
    }
  }

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
          title="Pre-visit intake summaries"
          subtitle="Chat-collected symptoms and context, ready before the consultation."
          action={
            <div className="flex items-center gap-2">
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {FILTERS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label} ({counts[item.key]})
                  </option>
                ))}
              </select>
              <Button variant="secondary" size="sm" onClick={load} loading={loading}>
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
            </div>
          }
        />

        {loading && !intakes.length ? (
          <Spinner label="Loading summaries..." />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No summaries here"
            description="When a patient completes the chat intake, their summary appears in this list before the visit."
          />
        ) : (
          <div className="px-4 pb-4 space-y-3">
            {visible.map((intake) => (
              <div
                key={intake._id}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">
                      {intake.patient?.name || "Patient"}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {intake.patient?.phone || "No phone"} ·{" "}
                      {intake.department?.name || "Department not set"} ·{" "}
                      {intake.createdAt ? formatDateTime(intake.createdAt) : "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <PriorityBadge priority={intake.suggestedPriority} />
                    <StatusBadge status={intake.status} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 mt-3 text-sm">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Reason
                    </p>
                    <p className="text-slate-700">{valueOrDash(intake.reason)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Symptoms
                    </p>
                    <p className="text-slate-700">{valueOrDash(intake.symptoms)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Duration / severity
                    </p>
                    <p className="text-slate-700">
                      {valueOrDash(intake.duration)}
                      {intake.severity !== undefined && intake.severity !== null
                        ? ` · ${intake.severity}/10`
                        : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Medicines / allergies
                    </p>
                    <p className="text-slate-700">
                      {valueOrDash(intake.medications)} · {valueOrDash(intake.allergies)}
                    </p>
                  </div>
                </div>

                {intake.redFlags?.length ? (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Red flags: {intake.redFlags.join(", ")}</span>
                  </div>
                ) : null}

                {intake.staffNotes ? (
                  <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <span className="font-semibold">Staff notes: </span>
                    {intake.staffNotes}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {intake.status === "pending" ? (
                    <Button
                      size="sm"
                      loading={busyId === intake._id}
                      onClick={() => updateIntake(intake._id, { status: "confirmed" })}
                    >
                      <Stethoscope className="w-4 h-4" />
                      Confirm for visit
                    </Button>
                  ) : null}
                  {intake.status !== "seen" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busyId === intake._id}
                      onClick={() => updateIntake(intake._id, { status: "seen" })}
                    >
                      Mark seen
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditor(intake)}
                  >
                    <ClipboardList className="w-4 h-4" />
                    Add note / priority
                  </Button>
                  {intake.appointment ? (
                    <Badge tone="blue">
                      {intake.appointment.date} · {intake.appointment.startTime}
                    </Badge>
                  ) : null}
                  {role === "doctor" && intake.doctor?.name ? (
                    <span className="text-xs text-slate-400">
                      {intake.doctor.name}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Update pre-visit summary"
        subtitle={editing?.patient?.name || "Patient"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" form="intake-note-form" loading={saving}>
              <Save className="w-4 h-4" />
              Save
            </Button>
          </>
        }
      >
        <form id="intake-note-form" onSubmit={saveEditor} className="space-y-4">
          <Field
            label="Priority"
            hint="The chatbot only suggests a priority. Staff confirm it here."
          >
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className={inputClass}
            >
              <option value="normal">Normal</option>
              <option value="senior">Senior</option>
              <option value="pregnant">Pregnant</option>
              <option value="emergency">Emergency</option>
            </select>
          </Field>
          <Field label="Staff notes" hint="Visible to the care team only.">
            <textarea
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value.slice(0, 2000))}
              placeholder="Verify symptoms, mobility needs, interpreter, anything the doctor should know"
              className={`${inputClass} resize-none`}
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
