"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Headset,
  Phone,
  Play,
  RefreshCw,
  SkipForward,
  Stethoscope,
  Ticket,
  UserPlus,
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
  PageLoader,
  PriorityBadge,
  Spinner,
  StatCard,
  StatusBadge,
  inputClass,
} from "@/components/ui";
import { apiRequest, formatDateInput, formatDateLabel, formatDateTime, formatTime } from "@/lib/api";
import HandoffPanel from "@/components/HandoffPanel";
import IntakePanel from "@/components/IntakePanel";
import { useQueue, useQueueEvents } from "@/lib/useQueue";
import { useUser } from "@/lib/useUser";

const TABS = [
  { key: "queue", label: "Live queue", icon: Activity },
  { key: "checkin", label: "Check-in", icon: ClipboardCheck },
  { key: "walkin", label: "Walk-in", icon: UserPlus },
  { key: "intake", label: "Pre-visit intake", icon: ClipboardList },
  { key: "handoffs", label: "Chat handoffs", icon: Headset },
];

const EMPTY_WALKIN = {
  name: "",
  phone: "",
  email: "",
  priority: "normal",
  notes: "",
};

export default function StaffDashboard() {
  const { user, loading, error: userError } = useUser({
    allowedRoles: ["receptionist", "staff", "admin"],
  });

  const [tab, setTab] = useState("queue");
  const [notice, setNotice] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(formatDateInput());
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  const [walkIn, setWalkIn] = useState(EMPTY_WALKIN);
  const [walkInBusy, setWalkInBusy] = useState(false);

  const today = formatDateInput();

  const {
    queue,
    loading: queueLoading,
    error: queueError,
    refresh,
  } = useQueue({ doctorId, date, enabled: Boolean(doctorId) });

  function flash(type, text) {
    setNotice({ type, text });
  }

  useEffect(() => {
    if (!user) return;
    apiRequest("/api/doctors")
      .then((data) => {
        const list = data.doctors || [];
        setDoctors(list);
        setDoctorId((prev) => prev || list[0]?._id || "");
      })
      .catch((error) => flash("error", error.message));
  }, [user]);

  const loadAppointments = useCallback(async () => {
    if (!doctorId) return;
    setAppointmentsLoading(true);
    try {
      const data = await apiRequest(
        `/api/appointments/doctor?doctorId=${doctorId}&date=${date}`
      );
      setAppointments(data.appointments || []);
    } catch (error) {
      flash("error", error.message);
    } finally {
      setAppointmentsLoading(false);
    }
  }, [doctorId, date]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const onQueueEvent = useCallback(() => {
    refresh();
    loadAppointments();
  }, [refresh, loadAppointments]);

  useQueueEvents(onQueueEvent);

  async function runAction(path, message) {
    setActionBusy(path);
    try {
      const data = await apiRequest(path, { method: "POST", body: {} });
      flash("success", data.message || message);
      await Promise.allSettled([refresh(), loadAppointments()]);
    } catch (error) {
      flash("error", error.message);
    } finally {
      setActionBusy("");
    }
  }

  async function handleCheckIn(appointment) {
    setBusyId(appointment._id);
    try {
      const data = await apiRequest("/api/queue/check-in", {
        method: "POST",
        body: { appointmentId: appointment._id, priority: appointment.priority },
      });
      flash(
        "success",
        `${data.message} ${appointment.patient?.name || "Patient"} is now waiting.`
      );
      await Promise.allSettled([refresh(), loadAppointments()]);
      setTab("queue");
    } catch (error) {
      flash("error", error.message);
    } finally {
      setBusyId("");
    }
  }

  async function handleWalkIn(event) {
    event.preventDefault();
    if (!doctorId) {
      flash("error", "Select a doctor first.");
      return;
    }
    if (!walkIn.name || !walkIn.phone) {
      flash("error", "Patient name and phone are required.");
      return;
    }

    setWalkInBusy(true);
    try {
      const data = await apiRequest("/api/queue/walk-in", {
        method: "POST",
        body: { ...walkIn, doctorId },
      });
      flash(
        "success",
        `${data.message} ${data.patient?.name || "Patient"} joined the queue.`
      );
      setWalkIn(EMPTY_WALKIN);
      await Promise.allSettled([refresh(), loadAppointments()]);
      setTab("queue");
    } catch (error) {
      flash("error", error.message);
    } finally {
      setWalkInBusy(false);
    }
  }

  if (loading) return <PageLoader label="Loading reception desk..." />;
  if (userError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <AlertBanner type="error">{userError}</AlertBanner>
      </div>
    );
  }
  if (!user) return null;

  const stats = queue?.stats || {
    total: 0,
    waiting: 0,
    completed: 0,
    avgWaitMinutes: 0,
  };
  const current = queue?.current || null;
  const waiting = queue?.waiting || [];
  const selectedDoctor = doctors.find((doctor) => doctor._id === doctorId);

  return (
    <AppShell
      user={user}
      roleLabel="Reception"
      title="Reception desk"
      subtitle="Check patients in, add walk-ins and keep the queue moving."
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      actions={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            refresh();
            loadAppointments();
          }}
        >
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

        <Card className="p-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Doctor">
              <select
                value={doctorId}
                onChange={(event) => setDoctorId(event.target.value)}
                className={inputClass}
              >
                {doctors.length === 0 ? (
                  <option value="">No doctors available</option>
                ) : null}
                {doctors.map((doctor) => (
                  <option key={doctor._id} value={doctor._id}>
                    {doctor.name} — {doctor.specialty}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Queue date">
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className={inputClass}
              />
            </Field>
            <div className="flex items-end">
              <div className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm">
                <p className="text-xs text-slate-500">Department</p>
                <p className="font-semibold text-slate-800">
                  {selectedDoctor?.department?.name || "—"}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {tab === "queue" ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="Waiting"
                value={stats.waiting}
                hint="In the live queue"
                icon={Users}
                tone="amber"
              />
              <StatCard
                label="Serving"
                value={current ? `#${current.tokenNumber}` : "—"}
                hint={current?.patient?.name || "Nobody yet"}
                icon={Stethoscope}
                tone="blue"
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
                hint="Check-in → start"
                icon={Clock}
                tone="violet"
              />
            </div>

            <Card>
              <CardHeader
                title="Now serving"
                subtitle={formatDateLabel(date)}
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
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
                        Token #{current.tokenNumber}
                      </p>
                      <p className="text-xl font-extrabold text-slate-900 mt-1">
                        {current.patient?.name || "Patient"}
                      </p>
                      <p className="text-sm text-slate-600 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />
                          {current.patient?.phone || "—"}
                        </span>
                        <span className="capitalize">{current.type}</span>
                        <PriorityBadge priority={current.priority} />
                      </p>
                    </div>
                    <StatusBadge status={current.status} />
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
                        Start
                      </Button>
                    ) : null}
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
                  title="Nobody is being served"
                  description={
                    waiting.length
                      ? "Call the next patient when the doctor is ready."
                      : "Check patients in or add a walk-in to start the queue."
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
                subtitle="Emergency, senior and pregnant patients are prioritised."
                action={<Badge tone="amber">{waiting.length} waiting</Badge>}
              />
              {waiting.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="The queue is empty"
                  description="Checked-in and walk-in patients appear here in real time."
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
                            {entry.estimatedWaitMinutes || 0} min ·{" "}
                            {entry.patient?.phone || "No phone"}
                          </p>
                        </div>
                      </div>
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
                  ))}
                </div>
              )}
            </Card>
          </>
        ) : null}

        {tab === "checkin" ? (
          <Card>
            <CardHeader
              title="Today's appointments"
              subtitle={
                date === today
                  ? `Check patients in for ${formatDateLabel(today)}.`
                  : "Check-in is only available on the appointment date."
              }
              action={<Badge tone="blue">{appointments.length} booked</Badge>}
            />
            {appointmentsLoading ? (
              <Spinner label="Loading appointments..." />
            ) : appointments.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No appointments for this doctor and date"
                description="Try another doctor or add the patient as a walk-in."
                action={
                  <Button onClick={() => setTab("walkin")}>
                    <UserPlus className="w-4 h-4" />
                    Add walk-in
                  </Button>
                }
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {appointments.map((appointment) => {
                  const canCheckIn =
                    date === today &&
                    appointment.status === "booked";
                  return (
                    <div
                      key={appointment._id}
                      className="px-5 py-4 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">
                            {appointment.patient?.name || "Patient"}
                          </p>
                          <StatusBadge status={appointment.status} />
                          <PriorityBadge priority={appointment.priority} />
                        </div>
                        <p className="text-sm text-slate-600 mt-1">
                          {formatTime(appointment.startTime)} ·{" "}
                          {appointment.patient?.phone || "No phone"}
                        </p>
                        {appointment.reason ? (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {appointment.reason}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        size="sm"
                        variant="success"
                        disabled={!canCheckIn}
                        loading={busyId === appointment._id}
                        onClick={() => handleCheckIn(appointment)}
                      >
                        <Ticket className="w-4 h-4" />
                        {canCheckIn ? "Check in" : "Not available"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        ) : null}

        {tab === "walkin" ? (
          <Card>
            <CardHeader
              title="Add a walk-in patient"
              subtitle={
                selectedDoctor
                  ? `Will join ${selectedDoctor.name}'s queue today.`
                  : "Select a doctor above."
              }
            />
            <form onSubmit={handleWalkIn} className="px-5 pb-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Patient name">
                  <input
                    value={walkIn.name}
                    onChange={(event) =>
                      setWalkIn((prev) => ({ ...prev, name: event.target.value }))
                    }
                    required
                    className={inputClass}
                    placeholder="Full name"
                  />
                </Field>
                <Field label="Phone">
                  <input
                    value={walkIn.phone}
                    onChange={(event) =>
                      setWalkIn((prev) => ({ ...prev, phone: event.target.value }))
                    }
                    required
                    className={inputClass}
                    placeholder="Phone number"
                  />
                </Field>
                <Field label="Email" hint="Optional. Used to match an existing patient.">
                  <input
                    type="email"
                    value={walkIn.email}
                    onChange={(event) =>
                      setWalkIn((prev) => ({ ...prev, email: event.target.value }))
                    }
                    className={inputClass}
                    placeholder="name@example.com"
                  />
                </Field>
                <Field label="Priority">
                  <select
                    value={walkIn.priority}
                    onChange={(event) =>
                      setWalkIn((prev) => ({
                        ...prev,
                        priority: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="normal">Normal</option>
                    <option value="senior">Senior citizen</option>
                    <option value="pregnant">Pregnant</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </Field>
              </div>

              <Field label="Notes" hint="Visible to the doctor in the queue.">
                <textarea
                  rows={3}
                  value={walkIn.notes}
                  onChange={(event) =>
                    setWalkIn((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  className={`${inputClass} resize-none`}
                  placeholder="e.g. Walked in with fever and dizziness"
                />
              </Field>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  A temporary patient record is created automatically if the phone
                  or email is new.
                </p>
                <Button type="submit" loading={walkInBusy} disabled={!doctorId}>
                  <UserPlus className="w-4 h-4" />
                  Add to queue
                </Button>
              </div>
            </form>
          </Card>
        ) : null}

        {tab === "intake" ? <IntakePanel role="staff" /> : null}
        {tab === "handoffs" ? <HandoffPanel /> : null}
      </div>
    </AppShell>
  );
}
