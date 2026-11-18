"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  ClipboardPlus,
  Clock,
  FileText,
  Phone,
  Play,
  RefreshCw,
  SkipForward,
  Stethoscope,
  Ticket,
  UserX,
  Users,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Modal,
  PageLoader,
  PriorityBadge,
  Spinner,
  StatCard,
  StatusBadge,
  inputClass,
} from "@/components/ui";
import { apiRequest, formatDateLabel, formatDateTime } from "@/lib/api";
import IntakePanel from "@/components/IntakePanel";
import { useQueue } from "@/lib/useQueue";
import { useUser } from "@/lib/useUser";

const TABS = [
  { key: "queue", label: "Live queue", icon: Activity },
  { key: "intake", label: "Pre-visit intake", icon: ClipboardList },
  { key: "reports", label: "My reports", icon: BarChart3 },
];

const EMPTY_RECORD = {
  diagnosis: "",
  notes: "",
  prescription: "",
  followUpDate: "",
};

export default function DoctorDashboard() {
  const router = useRouter();
  const { user, loading, error: userError } = useUser({
    allowedRoles: ["doctor"],
  });

  const [tab, setTab] = useState("queue");
  const [notice, setNotice] = useState(null);
  const [profile, setProfile] = useState(null);
  const [actionBusy, setActionBusy] = useState("");
  const [recordFor, setRecordFor] = useState(null);
  const [recordForm, setRecordForm] = useState(EMPTY_RECORD);
  const [savingRecord, setSavingRecord] = useState(false);
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const {
    queue,
    loading: queueLoading,
    error: queueError,
    refresh,
  } = useQueue({ doctorId: user?.id, enabled: Boolean(user) });

  function flash(type, text) {
    setNotice({ type, text });
  }

  useEffect(() => {
    if (!user) return;
    apiRequest("/api/doctors/profile")
      .then((data) => {
        if (!data.profileCompleted) {
          router.replace("/doctor/complete-profile");
          return;
        }
        setProfile(data.profile);
      })
      .catch((error) => flash("error", error.message));
  }, [user, router]);

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const data = await apiRequest("/api/reports/summary");
      setReport(data);
    } catch (error) {
      flash("error", error.message);
    } finally {
      setReportLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "reports") loadReport();
  }, [tab, loadReport]);

  const stats = queue?.stats || {
    total: 0,
    waiting: 0,
    completed: 0,
    avgWaitMinutes: 0,
  };

  const current = queue?.current || null;
  const waiting = useMemo(() => queue?.waiting || [], [queue]);
  const completed = queue?.completed || [];

  const nextUp = useMemo(() => waiting[0] || null, [waiting]);

  async function runAction(path, message) {
    setActionBusy(path);
    try {
      const data = await apiRequest(path, { method: "POST", body: {} });
      flash("success", data.message || message);
      await refresh();
    } catch (error) {
      flash("error", error.message);
    } finally {
      setActionBusy("");
    }
  }

  function openRecord(entry) {
    setRecordFor(entry);
    setRecordForm(EMPTY_RECORD);
  }

  async function submitRecord(event) {
    event.preventDefault();
    if (!recordFor) return;
    setSavingRecord(true);
    try {
      const data = await apiRequest("/api/records", {
        method: "POST",
        body: {
          patientId: recordFor.patient?._id,
          appointmentId: recordFor.appointment?._id || undefined,
          queueEntryId: recordFor._id,
          ...recordForm,
        },
      });
      flash("success", data.message || "Medical record saved.");
      setRecordFor(null);
      await refresh();
    } catch (error) {
      flash("error", error.message);
    } finally {
      setSavingRecord(false);
    }
  }

  if (loading) return <PageLoader label="Loading your queue..." />;
  if (userError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <AlertBanner type="error">{userError}</AlertBanner>
      </div>
    );
  }
  if (!user) return null;

  return (
    <AppShell
      user={user}
      roleLabel="Doctor"
      title="Doctor dashboard"
      subtitle={
        profile?.department?.name
          ? `${user.name} · ${profile.department.name}`
          : user.name
      }
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      actions={
        <Button variant="secondary" size="sm" onClick={() => refresh()}>
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      }
    >
      <div className="space-y-5">
        {notice ? (
          <AlertBanner type={notice.type} onClose={() => setNotice(null)}>
            {notice.text}
          </AlertBanner>
        ) : null}
        {queueError ? (
          <AlertBanner type="error">{queueError}</AlertBanner>
        ) : null}

        {tab === "queue" ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="In queue"
                value={stats.waiting}
                hint="Waiting patients"
                icon={Users}
                tone="amber"
              />
              <StatCard
                label="Completed"
                value={stats.completed}
                hint="Today's visits"
                icon={CheckCircle2}
                tone="green"
              />
              <StatCard
                label="Avg wait"
                value={`${stats.avgWaitMinutes || 0}m`}
                hint="Checked in → started"
                icon={Clock}
                tone="blue"
              />
              <StatCard
                label="Total today"
                value={stats.total}
                hint="All tokens issued"
                icon={Ticket}
                tone="violet"
              />
            </div>

            <Card>
              <CardHeader
                title="Now serving"
                subtitle={formatDateLabel(
                  queue?.date || new Date().toISOString().slice(0, 10)
                )}
                action={
                  <Button
                    size="sm"
                    onClick={() =>
                      runAction("/api/queue/call-next", "Called the next patient")
                    }
                    loading={actionBusy === "/api/queue/call-next"}
                    disabled={Boolean(current) || waiting.length === 0}
                  >
                    <ArrowRight className="w-4 h-4" />
                    Call next
                  </Button>
                }
              />

              {queueLoading && !queue ? (
                <Spinner label="Loading queue..." />
              ) : current ? (
                <div className="px-5 pb-5">
                  <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-blue-100">
                          Token #{current.tokenNumber}
                        </p>
                        <p className="text-2xl font-extrabold mt-1">
                          {current.patient?.name || "Patient"}
                        </p>
                        <p className="text-sm text-blue-100 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {current.patient?.phone || "—"}
                          </span>
                          <span className="capitalize">{current.type}</span>
                          <PriorityBadge priority={current.priority} />
                        </p>
                        {current.appointment?.reason ? (
                          <p className="text-sm text-blue-100 mt-2">
                            Reason: {current.appointment.reason}
                          </p>
                        ) : null}
                      </div>
                      <StatusBadge status={current.status} />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-sm">
                      <div className="rounded-xl bg-white/10 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-blue-100">
                          Checked in
                        </p>
                        <p className="font-semibold">
                          {current.checkedInAt
                            ? formatDateTime(current.checkedInAt)
                            : "—"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white/10 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-blue-100">
                          Called at
                        </p>
                        <p className="font-semibold">
                          {current.calledAt ? formatDateTime(current.calledAt) : "—"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white/10 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-blue-100">
                          Waiting
                        </p>
                        <p className="font-semibold">
                          {nextUp ? `${waiting.length} more` : "No one else"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    {current.status === "called" ? (
                      <Button
                        size="sm"
                        variant="success"
                        loading={actionBusy === `/api/queue/${current._id}/start`}
                        onClick={() =>
                          runAction(
                            `/api/queue/${current._id}/start`,
                            "Consultation started"
                          )
                        }
                      >
                        <Play className="w-4 h-4" />
                        Start consultation
                      </Button>
                    ) : null}

                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openRecord(current)}
                    >
                      <ClipboardPlus className="w-4 h-4" />
                      Add record & complete
                    </Button>

                    <Button
                      size="sm"
                      variant="success"
                      loading={actionBusy === `/api/queue/${current._id}/complete`}
                      onClick={() =>
                        runAction(
                          `/api/queue/${current._id}/complete`,
                          "Patient marked as completed"
                        )
                      }
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Complete
                    </Button>

                    <Button
                      size="sm"
                      variant="secondary"
                      loading={actionBusy === `/api/queue/${current._id}/skip`}
                      onClick={() =>
                        runAction(
                          `/api/queue/${current._id}/skip`,
                          "Patient skipped"
                        )
                      }
                    >
                      <SkipForward className="w-4 h-4" />
                      Skip
                    </Button>

                    <Button
                      size="sm"
                      variant="danger"
                      loading={actionBusy === `/api/queue/${current._id}/no-show`}
                      onClick={() =>
                        runAction(
                          `/api/queue/${current._id}/no-show`,
                          "Marked as no-show"
                        )
                      }
                    >
                      <UserX className="w-4 h-4" />
                      No-show
                    </Button>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={Stethoscope}
                  title="No patient is being served"
                  description={
                    waiting.length
                      ? "Call the next patient when you're ready."
                      : "Patients will appear here as they check in."
                  }
                  action={
                    waiting.length ? (
                      <Button
                        onClick={() =>
                          runAction(
                            "/api/queue/call-next",
                            "Called the next patient"
                          )
                        }
                        loading={actionBusy === "/api/queue/call-next"}
                      >
                        <ArrowRight className="w-4 h-4" />
                        Call token #{waiting[0].tokenNumber}
                      </Button>
                    ) : null
                  }
                />
              )}
            </Card>

            <Card>
              <CardHeader
                title="Waiting queue"
                subtitle="Priority patients are automatically moved to the front."
                action={<Badge tone="amber">{waiting.length} waiting</Badge>}
              />
              {waiting.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No one is waiting"
                  description="New check-ins from reception will appear here instantly."
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {waiting.map((entry) => (
                    <div
                      key={entry._id}
                      className="px-5 py-3 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 font-extrabold flex items-center justify-center shrink-0">
                          {entry.tokenNumber}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900 truncate">
                              {entry.patient?.name || "Patient"}
                            </p>
                            <PriorityBadge priority={entry.priority} />
                            <Badge tone={entry.type === "walk-in" ? "amber" : "blue"}>
                              {entry.type === "walk-in" ? "Walk-in" : "Pre-booked"}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Position {entry.position} · ~
                            {entry.estimatedWaitMinutes || 0} min wait ·
                            Checked in{" "}
                            {entry.checkedInAt
                              ? formatDateTime(entry.checkedInAt)
                              : "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={actionBusy === `/api/queue/${entry._id}/skip`}
                          onClick={() =>
                            runAction(
                              `/api/queue/${entry._id}/skip`,
                              "Patient skipped"
                            )
                          }
                        >
                          Skip
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Completed today"
                subtitle={`${completed.length} consultation${completed.length === 1 ? "" : "s"} finished`}
              />
              {completed.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No completed visits yet"
                  description="Completed consultations will be listed here."
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {completed.map((entry) => (
                    <div
                      key={entry._id}
                      className="px-5 py-3 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          #{entry.tokenNumber} · {entry.patient?.name || "Patient"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {entry.completedAt
                            ? `Completed ${formatDateTime(entry.completedAt)}`
                            : "Completed"}
                          {entry.priority !== "normal" ? ` · ${entry.priority}` : ""}
                        </p>
                      </div>
                      <StatusBadge status="completed" />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        ) : null}

        {tab === "reports" ? (
          <div className="space-y-5">
            {reportLoading && !report ? (
              <Spinner label="Loading report..." />
            ) : report ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatCard
                    label="Appointments"
                    value={report.totals.appointments}
                    hint={`${report.range.from} → ${report.range.to}`}
                    icon={CalendarIcon}
                    tone="blue"
                  />
                  <StatCard
                    label="Avg wait"
                    value={`${report.averages.waitMinutes}m`}
                    hint="Checked in → consultation"
                    icon={Clock}
                    tone="amber"
                  />
                  <StatCard
                    label="Avg consult"
                    value={`${report.averages.consultationMinutes}m`}
                    hint="Consultation duration"
                    icon={Stethoscope}
                    tone="green"
                  />
                  <StatCard
                    label="No-show rate"
                    value={`${report.totals.noShowRate}%`}
                    hint={`${report.totals.noShow} no-shows`}
                    icon={UserX}
                    tone="red"
                  />
                </div>

                <Card>
                  <CardHeader
                    title="Peak hours"
                    subtitle="Appointment volume by start hour."
                  />
                  <div className="px-5 pb-5 space-y-2">
                    {report.peakHours.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No appointments in this range yet.
                      </p>
                    ) : (
                      report.peakHours.map((item) => {
                        const max = Math.max(
                          ...report.peakHours.map((entry) => entry.count),
                          1
                        );
                        return (
                          <div key={item.hour} className="flex items-center gap-3">
                            <span className="w-16 text-xs font-semibold text-slate-500">
                              {item.hour}
                            </span>
                            <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
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
                    title="My patient load"
                    subtitle="Appointments handled in the selected range."
                  />
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-5 py-3 font-semibold">Doctor</th>
                          <th className="px-5 py-3 font-semibold">Appointments</th>
                          <th className="px-5 py-3 font-semibold">Completed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report.doctorLoad.map((row) => (
                          <tr key={row.doctorId}>
                            <td className="px-5 py-3 font-medium text-slate-900">
                              {row.name}
                            </td>
                            <td className="px-5 py-3 text-slate-600">{row.total}</td>
                            <td className="px-5 py-3 text-slate-600">
                              {row.completed}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            ) : null}
          </div>
        ) : null}

        {tab === "intake" ? <IntakePanel role="doctor" /> : null}
      </div>

      <Modal
        open={Boolean(recordFor)}
        onClose={() => setRecordFor(null)}
        title="Consultation record"
        subtitle={
          recordFor
            ? `Token #${recordFor.tokenNumber} · ${recordFor.patient?.name || "Patient"}`
            : ""
        }
        wide
      >
        <form onSubmit={submitRecord} className="space-y-4">
          <Field label="Diagnosis">
            <textarea
              rows={3}
              value={recordForm.diagnosis}
              onChange={(event) =>
                setRecordForm((prev) => ({
                  ...prev,
                  diagnosis: event.target.value,
                }))
              }
              required
              className={`${inputClass} resize-none`}
              placeholder="Clinical impression and diagnosis"
            />
          </Field>
          <Field label="Prescription">
            <textarea
              rows={3}
              value={recordForm.prescription}
              onChange={(event) =>
                setRecordForm((prev) => ({
                  ...prev,
                  prescription: event.target.value,
                }))
              }
              className={`${inputClass} resize-none`}
              placeholder="Medicines, dosage and duration"
            />
          </Field>
          <Field label="Notes">
            <textarea
              rows={3}
              value={recordForm.notes}
              onChange={(event) =>
                setRecordForm((prev) => ({ ...prev, notes: event.target.value }))
              }
              className={`${inputClass} resize-none`}
              placeholder="Observations, tests advised, lifestyle advice"
            />
          </Field>
          <Field label="Follow-up date">
            <input
              type="date"
              value={recordForm.followUpDate}
              onChange={(event) =>
                setRecordForm((prev) => ({
                  ...prev,
                  followUpDate: event.target.value,
                }))
              }
              className={inputClass}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRecordFor(null)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={savingRecord}>
              <CheckCircle2 className="w-4 h-4" />
              Save & complete visit
            </Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}

function CalendarIcon(props) {
  return <Ticket {...props} />;
}
