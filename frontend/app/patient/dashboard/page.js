"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  History,
  MapPin,
  Plus,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  Ticket,
  User,
  XCircle,
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
  StatusBadge,
  inputClass,
} from "@/components/ui";
import {
  apiRequest,
  formatDateInput,
  formatDateLabel,
  formatDateTime,
  formatTime,
} from "@/lib/api";
import { useQueueEvents } from "@/lib/useQueue";
import { useUser } from "@/lib/useUser";

const TABS = [
  { key: "queue", label: "Queue status", icon: Activity },
  { key: "book", label: "Book appointment", icon: Plus },
  { key: "appointments", label: "My appointments", icon: CalendarDays },
  { key: "history", label: "Visit history", icon: History },
  { key: "profile", label: "Profile", icon: User },
];

const EMPTY_PROFILE = {
  name: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  address: "",
  bloodGroup: "",
  emergencyContact: "",
  consentAccepted: false,
};

const EMPTY_MEDICAL = {
  bloodGroup: "",
  allergies: "",
  conditions: "",
  medications: "",
  notes: "",
};

export default function PatientDashboard() {
  const { user, loading, error: userError } = useUser({
    allowedRoles: ["patient"],
  });

  const [tab, setTab] = useState("queue");
  const [notice, setNotice] = useState(null);

  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE);
  const [medicalForm, setMedicalForm] = useState(EMPTY_MEDICAL);
  const [savingProfile, setSavingProfile] = useState(false);

  const [appointments, setAppointments] = useState([]);
  const [today, setToday] = useState(formatDateInput());
  const [activeQueue, setActiveQueue] = useState([]);
  const [history, setHistory] = useState(null);

  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [booking, setBooking] = useState({
    departmentId: "",
    doctorId: "",
    date: formatDateInput(),
    startTime: "",
    reason: "",
    priority: "normal",
  });
  const [bookingBusy, setBookingBusy] = useState(false);
  const [busyId, setBusyId] = useState("");

  function flash(type, text) {
    setNotice({ type, text });
  }

  const loadProfile = useCallback(async () => {
    const data = await apiRequest("/api/patients/me");
    setProfile(data.profile);
    setProfileForm({
      name: data.profile?.name || "",
      phone: data.profile?.phone || "",
      dateOfBirth: data.profile?.patientProfile?.dateOfBirth || "",
      gender: data.profile?.patientProfile?.gender || "",
      address: data.profile?.patientProfile?.address || "",
      bloodGroup:
        data.profile?.patientProfile?.bloodGroup ||
        data.medicalInfo?.bloodGroup ||
        "",
      emergencyContact: data.profile?.patientProfile?.emergencyContact || "",
      consentAccepted: Boolean(data.profile?.consentAccepted),
    });
    setMedicalForm({
      bloodGroup:
        data.medicalInfo?.bloodGroup ||
        data.profile?.patientProfile?.bloodGroup ||
        "",
      allergies: data.medicalInfo?.allergies || "",
      conditions: data.medicalInfo?.conditions || "",
      medications: data.medicalInfo?.medications || "",
      notes: data.medicalInfo?.notes || "",
    });
  }, []);

  const loadAppointments = useCallback(async () => {
    const data = await apiRequest("/api/appointments/me");
    setAppointments(data.appointments || []);
    setToday(data.today || formatDateInput());
  }, []);

  const loadQueueStatus = useCallback(async () => {
    const data = await apiRequest("/api/queue/my-status");
    setActiveQueue(data.active || []);
  }, []);

  const loadHistory = useCallback(async () => {
    const data = await apiRequest("/api/patients/me/history");
    setHistory(data);
  }, []);

  useEffect(() => {
    if (!user) return;
    Promise.allSettled([
      loadProfile(),
      loadAppointments(),
      loadQueueStatus(),
      apiRequest("/api/departments").then((data) =>
        setDepartments(data.departments || [])
      ),
      apiRequest("/api/doctors").then((data) => setDoctors(data.doctors || [])),
    ]);
  }, [user, loadProfile, loadAppointments, loadQueueStatus]);

  const onQueueEvent = useCallback(() => {
    loadQueueStatus().catch(() => {});
    loadAppointments().catch(() => {});
  }, [loadQueueStatus, loadAppointments]);

  useQueueEvents(onQueueEvent);

  useEffect(() => {
    if (!user) return undefined;
    const timer = setInterval(() => {
      loadQueueStatus().catch(() => {});
    }, 20000);
    return () => clearInterval(timer);
  }, [user, loadQueueStatus]);

  useEffect(() => {
    if (tab === "history" && !history) {
      loadHistory().catch((error) => flash("error", error.message));
    }
  }, [tab, history, loadHistory]);

  useEffect(() => {
    if (!booking.doctorId || !booking.date) {
      setSlots([]);
      return undefined;
    }

    let cancelled = false;
    setSlotsLoading(true);
    apiRequest(`/api/doctors/${booking.doctorId}/slots?date=${booking.date}`)
      .then((data) => {
        if (!cancelled) setSlots(data.slots || []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [booking.doctorId, booking.date]);

  const filteredDoctors = useMemo(() => {
    if (!booking.departmentId) return doctors;
    return doctors.filter(
      (doctor) =>
        String(doctor.department?._id || doctor.department) ===
        booking.departmentId
    );
  }, [doctors, booking.departmentId]);

  const selectedDoctor = useMemo(
    () => doctors.find((doctor) => doctor._id === booking.doctorId) || null,
    [doctors, booking.doctorId]
  );

  const upcoming = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          ["booked", "checked-in", "in-queue"].includes(appointment.status) &&
          appointment.date >= today
      ),
    [appointments, today]
  );

  function updateBooking(field, value) {
    setBooking((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "departmentId") {
        next.doctorId = "";
        next.startTime = "";
      }
      if (field === "doctorId") {
        next.startTime = "";
        const doctor = doctors.find((item) => item._id === value);
        if (doctor && !prev.departmentId) {
          next.departmentId = doctor.department?._id || "";
        }
      }
      if (field === "date") next.startTime = "";
      return next;
    });
  }

  async function handleBook(event) {
    event.preventDefault();
    if (!booking.doctorId || !booking.startTime) {
      flash("error", "Please choose a doctor and an available time slot.");
      return;
    }

    setBookingBusy(true);
    try {
      const data = await apiRequest("/api/appointments", {
        method: "POST",
        body: {
          doctorId: booking.doctorId,
          departmentId: booking.departmentId || undefined,
          date: booking.date,
          startTime: booking.startTime,
          reason: booking.reason,
          priority: booking.priority,
        },
      });
      flash("success", data.message || "Appointment booked successfully.");
      setBooking((prev) => ({ ...prev, startTime: "", reason: "" }));
      await Promise.allSettled([loadAppointments(), loadQueueStatus()]);
      setTab("appointments");
    } catch (error) {
      flash("error", error.message);
    } finally {
      setBookingBusy(false);
    }
  }

  async function handleCheckIn(appointment) {
    setBusyId(appointment._id);
    try {
      const data = await apiRequest("/api/queue/check-in", {
        method: "POST",
        body: { appointmentId: appointment._id },
      });
      flash(
        "success",
        `${data.message} Keep an eye on the live queue below.`
      );
      await Promise.allSettled([loadAppointments(), loadQueueStatus()]);
      setTab("queue");
    } catch (error) {
      flash("error", error.message);
    } finally {
      setBusyId("");
    }
  }

  async function handleCancel(appointment) {
    if (
      !window.confirm(
        `Cancel your appointment on ${formatDateLabel(appointment.date)} at ${formatTime(appointment.startTime)}?`
      )
    ) {
      return;
    }

    setBusyId(appointment._id);
    try {
      const data = await apiRequest(
        `/api/appointments/${appointment._id}/cancel`,
        { method: "PATCH", body: { reason: "Cancelled by patient" } }
      );
      flash("success", data.message || "Appointment cancelled.");
      await Promise.allSettled([loadAppointments(), loadQueueStatus()]);
    } catch (error) {
      flash("error", error.message);
    } finally {
      setBusyId("");
    }
  }

  async function handleSaveProfile(event) {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const data = await apiRequest("/api/patients/me", {
        method: "PUT",
        body: {
          name: profileForm.name,
          phone: profileForm.phone,
          consentAccepted: profileForm.consentAccepted,
          patientProfile: {
            dateOfBirth: profileForm.dateOfBirth,
            gender: profileForm.gender,
            address: profileForm.address,
            bloodGroup: profileForm.bloodGroup,
            emergencyContact: profileForm.emergencyContact,
          },
          medicalInfo: medicalForm,
        },
      });
      flash("success", data.message || "Profile updated.");
      await loadProfile();
    } catch (error) {
      flash("error", error.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleExport() {
    try {
      const data = await apiRequest("/api/patients/me/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "mediqueue-my-data.json";
      anchor.click();
      URL.revokeObjectURL(url);
      flash("success", "Your data export has been downloaded.");
    } catch (error) {
      flash("error", error.message);
    }
  }

  if (loading) return <PageLoader label="Loading your dashboard..." />;
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
      roleLabel="Patient"
      title="Patient dashboard"
      subtitle="Book visits, track your token and review your care history."
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      actions={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            loadQueueStatus().catch(() => {});
            loadAppointments().catch(() => {});
          }}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      }
    >
      <div className="space-y-5">
        {notice ? (
          <AlertBanner
            type={notice.type}
            onClose={() => setNotice(null)}
          >
            {notice.text}
          </AlertBanner>
        ) : null}

        {tab === "queue" ? (
          <div className="space-y-5">
            {activeQueue.length === 0 ? (
              <Card>
                <EmptyState
                  icon={Ticket}
                  title="You are not in a queue right now"
                  description="Book an appointment and check in on the day of your visit to receive your digital token."
                  action={
                    <Button onClick={() => setTab("book")}>
                      <Plus className="w-4 h-4" />
                      Book an appointment
                    </Button>
                  }
                />
              </Card>
            ) : (
              activeQueue.map((item) => (
                <QueueStatusCard key={item.entry._id} item={item} />
              ))
            )}

            <Card>
              <CardHeader
                title="Upcoming appointments"
                subtitle="Check in on the day of your visit to join the live queue."
                action={
                  <Button variant="ghost" size="sm" onClick={() => setTab("appointments")}>
                    View all
                  </Button>
                }
              />
              {upcoming.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="No upcoming appointments"
                  description="Choose a doctor, department and time slot to get started."
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {upcoming.map((appointment) => (
                    <AppointmentRow
                      key={appointment._id}
                      appointment={appointment}
                      today={today}
                      busy={busyId === appointment._id}
                      onCheckIn={handleCheckIn}
                      onCancel={handleCancel}
                    />
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : null}

        {tab === "book" ? (
          <Card>
            <CardHeader
              title="Book an appointment"
              subtitle="Pick a department, doctor and an open time slot."
            />
            <form onSubmit={handleBook} className="px-5 pb-6 space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Department" hint="Optional: helps narrow down doctors.">
                  <select
                    value={booking.departmentId}
                    onChange={(event) =>
                      updateBooking("departmentId", event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">All departments</option>
                    {departments.map((department) => (
                      <option key={department._id} value={department._id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Doctor">
                  <select
                    value={booking.doctorId}
                    onChange={(event) =>
                      updateBooking("doctorId", event.target.value)
                    }
                    required
                    className={inputClass}
                  >
                    <option value="">Select a doctor</option>
                    {filteredDoctors.map((doctor) => (
                      <option key={doctor._id} value={doctor._id}>
                        {doctor.name} — {doctor.specialty}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Date">
                  <input
                    type="date"
                    min={today}
                    value={booking.date}
                    onChange={(event) => updateBooking("date", event.target.value)}
                    required
                    className={inputClass}
                  />
                </Field>

                <Field label="Priority">
                  <select
                    value={booking.priority}
                    onChange={(event) =>
                      updateBooking("priority", event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="normal">Normal</option>
                    <option value="senior">Senior citizen</option>
                    <option value="pregnant">Pregnant</option>
                  </select>
                </Field>
              </div>

              {selectedDoctor ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  <p className="font-semibold">{selectedDoctor.name}</p>
                  <p className="text-xs mt-0.5">
                    {selectedDoctor.qualification} · {selectedDoctor.experience} yrs experience · ₹
                    {selectedDoctor.consultationFee} consultation
                  </p>
                </div>
              ) : null}

              <div>
                <p className="text-sm font-semibold text-slate-800 mb-2">
                  Available time slots
                </p>
                {!booking.doctorId ? (
                  <p className="text-sm text-slate-500">
                    Select a doctor to see available slots.
                  </p>
                ) : slotsLoading ? (
                  <Spinner label="Loading slots..." />
                ) : slots.length === 0 ? (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    No slots are available for this date. Try another day.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    {slots.map((slot) => {
                      const selected = booking.startTime === slot.startTime;
                      return (
                        <button
                          key={slot.startTime}
                          type="button"
                          onClick={() => updateBooking("startTime", slot.startTime)}
                          className={`rounded-xl border px-2 py-2 text-xs font-semibold transition-colors ${
                            selected
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-slate-700 border-slate-200 hover:border-blue-300"
                          }`}
                        >
                          {formatTime(slot.startTime)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <Field label="Reason for visit" hint="Briefly describe your symptoms or concern.">
                <textarea
                  rows={3}
                  value={booking.reason}
                  onChange={(event) => updateBooking("reason", event.target.value)}
                  placeholder="e.g. Recurring headaches for the past week"
                  className={`${inputClass} resize-none`}
                />
              </Field>

              <div className="flex justify-end">
                <Button type="submit" loading={bookingBusy}>
                  <CalendarDays className="w-4 h-4" />
                  Confirm booking
                </Button>
              </div>
            </form>
          </Card>
        ) : null}

        {tab === "appointments" ? (
          <Card>
            <CardHeader
              title="My appointments"
              subtitle={`${appointments.length} appointment${appointments.length === 1 ? "" : "s"} on record`}
              action={
                <Button size="sm" onClick={() => setTab("book")}>
                  <Plus className="w-4 h-4" />
                  New booking
                </Button>
              }
            />
            {appointments.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No appointments yet"
                description="Book your first appointment to get started."
                action={
                  <Button onClick={() => setTab("book")}>Book now</Button>
                }
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {appointments.map((appointment) => (
                  <AppointmentRow
                    key={appointment._id}
                    appointment={appointment}
                    today={today}
                    busy={busyId === appointment._id}
                    onCheckIn={handleCheckIn}
                    onCancel={handleCancel}
                    showDate
                  />
                ))}
              </div>
            )}
          </Card>
        ) : null}

        {tab === "history" ? (
          <div className="space-y-5">
            <Card>
              <CardHeader
                title="Medical records"
                subtitle="Notes written by your doctors after each visit."
              />
              {!history ? (
                <Spinner label="Loading visit history..." />
              ) : history.records.length === 0 ? (
                <EmptyState
                  icon={ShieldCheck}
                  title="No medical records yet"
                  description="Records appear here after a completed consultation."
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {history.records.map((record) => (
                    <div key={record._id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {record.doctor?.name || "Doctor"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDateTime(record.visitDate)}
                          </p>
                        </div>
                        {record.followUpDate ? (
                          <Badge tone="blue">
                            Follow-up {formatDateLabel(record.followUpDate)}
                          </Badge>
                        ) : null}
                      </div>
                      <dl className="mt-3 grid gap-2 text-sm">
                        <div>
                          <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
                            Diagnosis
                          </dt>
                          <dd className="text-slate-700">
                            {record.diagnosis || "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
                            Prescription
                          </dt>
                          <dd className="text-slate-700">
                            {record.prescription || "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
                            Notes
                          </dt>
                          <dd className="text-slate-700">{record.notes || "—"}</dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Visit & queue history"
                subtitle="Every token you have taken and the outcome."
              />
              {!history ? null : history.queueEntries.length === 0 ? (
                <EmptyState
                  icon={History}
                  title="No queue history yet"
                  description="Your tokens and visit outcomes will be listed here."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Date</th>
                        <th className="px-5 py-3 font-semibold">Token</th>
                        <th className="px-5 py-3 font-semibold">Doctor</th>
                        <th className="px-5 py-3 font-semibold">Type</th>
                        <th className="px-5 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {history.queueEntries.map((entry) => (
                        <tr key={entry._id}>
                          <td className="px-5 py-3 text-slate-600">
                            {formatDateLabel(entry.date)}
                          </td>
                          <td className="px-5 py-3 font-semibold text-slate-900">
                            #{entry.tokenNumber}
                          </td>
                          <td className="px-5 py-3 text-slate-600">
                            {entry.doctor?.name || "—"}
                          </td>
                          <td className="px-5 py-3 text-slate-600 capitalize">
                            {entry.type}
                          </td>
                          <td className="px-5 py-3">
                            <StatusBadge status={entry.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        ) : null}

        {tab === "profile" ? (
          <div className="space-y-5">
            <Card>
              <CardHeader
                title="Profile & medical information"
                subtitle="Sensitive medical fields are encrypted at rest."
              />
              <form onSubmit={handleSaveProfile} className="px-5 pb-6 space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Full name">
                    <input
                      value={profileForm.name}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                      required
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      value={profileForm.phone}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          phone: event.target.value,
                        }))
                      }
                      required
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Date of birth">
                    <input
                      type="date"
                      value={profileForm.dateOfBirth}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          dateOfBirth: event.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Gender">
                    <select
                      value={profileForm.gender}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          gender: event.target.value,
                        }))
                      }
                      className={inputClass}
                    >
                      <option value="">Prefer not to say</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                  <Field label="Blood group">
                    <input
                      value={profileForm.bloodGroup}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          bloodGroup: event.target.value,
                        }))
                      }
                      placeholder="e.g. O+"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Emergency contact">
                    <input
                      value={profileForm.emergencyContact}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          emergencyContact: event.target.value,
                        }))
                      }
                      placeholder="Phone number"
                      className={inputClass}
                    />
                  </Field>
                </div>

                <Field label="Address">
                  <textarea
                    rows={2}
                    value={profileForm.address}
                    onChange={(event) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        address: event.target.value,
                      }))
                    }
                    className={`${inputClass} resize-none`}
                  />
                </Field>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-bold text-slate-900 mb-3">
                    Medical information
                  </p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Allergies">
                      <textarea
                        rows={2}
                        value={medicalForm.allergies}
                        onChange={(event) =>
                          setMedicalForm((prev) => ({
                            ...prev,
                            allergies: event.target.value,
                          }))
                        }
                        placeholder="e.g. Penicillin"
                        className={`${inputClass} resize-none`}
                      />
                    </Field>
                    <Field label="Existing conditions">
                      <textarea
                        rows={2}
                        value={medicalForm.conditions}
                        onChange={(event) =>
                          setMedicalForm((prev) => ({
                            ...prev,
                            conditions: event.target.value,
                          }))
                        }
                        placeholder="e.g. Hypertension"
                        className={`${inputClass} resize-none`}
                      />
                    </Field>
                    <Field label="Current medications">
                      <textarea
                        rows={2}
                        value={medicalForm.medications}
                        onChange={(event) =>
                          setMedicalForm((prev) => ({
                            ...prev,
                            medications: event.target.value,
                          }))
                        }
                        placeholder="e.g. Amlodipine 5mg"
                        className={`${inputClass} resize-none`}
                      />
                    </Field>
                    <Field label="Other notes">
                      <textarea
                        rows={2}
                        value={medicalForm.notes}
                        onChange={(event) =>
                          setMedicalForm((prev) => ({
                            ...prev,
                            notes: event.target.value,
                          }))
                        }
                        placeholder="Anything your doctor should know"
                        className={`${inputClass} resize-none`}
                      />
                    </Field>
                  </div>
                </div>

                <label className="flex items-start gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={profileForm.consentAccepted}
                    onChange={(event) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        consentAccepted: event.target.checked,
                      }))
                    }
                    className="mt-0.5 h-4 w-4 accent-blue-600"
                  />
                  <span>
                    I consent to MediQueue storing my medical information to
                    coordinate my care. I understand I can export or update my
                    data at any time.
                  </span>
                </label>

                <div className="flex justify-end">
                  <Button type="submit" loading={savingProfile}>
                    Save changes
                  </Button>
                </div>
              </form>
            </Card>

            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Privacy & data portability
                  </p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Download a copy of your profile, appointments, queue history and
                    medical records.
                  </p>
                </div>
                <Button variant="secondary" onClick={handleExport}>
                  <Download className="w-4 h-4" />
                  Export my data
                </Button>
              </div>
              {medicalForm.allergies ||
              medicalForm.conditions ||
              medicalForm.medications ? (
                <p className="mt-4 text-xs text-slate-500 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  Medical details are encrypted with AES-256-GCM and only shared
                  with your treating doctor and authorised staff.
                </p>
              ) : null}
            </Card>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function QueueStatusCard({ item }) {
  const entry = item.entry;
  const isTurn =
    entry.status === "called" || entry.status === "in-progress";
  const position = item.position;

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-100">
              Your token
            </p>
            <p className="text-5xl font-black leading-none mt-2">
              #{entry.tokenNumber}
            </p>
            <p className="text-sm text-blue-100 mt-2 flex items-center gap-1.5">
              <Stethoscope className="w-4 h-4" />
              {item.doctor?.name || "Doctor"}
              {item.department?.name ? ` · ${item.department.name}` : ""}
            </p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              Live
            </span>
            <p className="text-xs uppercase tracking-wide text-blue-100 mt-3">
              Position
            </p>
            <p className="text-3xl font-extrabold">
              {isTurn ? "Now" : position ?? "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        <div className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Now serving
          </p>
          <p className="text-xl font-extrabold text-slate-900 mt-1">
            {item.currentToken ? `#${item.currentToken}` : "—"}
          </p>
        </div>
        <div className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Estimated wait
          </p>
          <p className="text-xl font-extrabold text-slate-900 mt-1">
            {isTurn ? "Your turn" : `~${item.estimatedWaitMinutes || 0} min`}
          </p>
        </div>
        <div className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Waiting ahead
          </p>
          <p className="text-xl font-extrabold text-slate-900 mt-1">
            {isTurn ? 0 : Math.max(0, position - 1)}
          </p>
        </div>
      </div>

      <div
        className={`px-5 py-3 text-sm font-medium ${
          isTurn
            ? "bg-emerald-50 text-emerald-800"
            : "bg-amber-50 text-amber-800"
        }`}
      >
        {isTurn
          ? "It's your turn — please proceed to the doctor's room."
          : position === 1
            ? "You're next. Please stay close to the waiting area."
            : "Relax — we'll send you a notification when your turn is near."}
      </div>
    </Card>
  );
}

function AppointmentRow({
  appointment,
  today,
  busy,
  onCheckIn,
  onCancel,
  showDate = false,
}) {
  const canCheckIn =
    appointment.date === today && appointment.status === "booked";
  const canCancel = ["booked", "checked-in", "in-queue"].includes(
    appointment.status
  );

  return (
    <div className="px-5 py-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-900">
            {appointment.doctor?.name || "Doctor"}
          </p>
          <StatusBadge status={appointment.status} />
          <PriorityBadge priority={appointment.priority} />
        </div>
        <p className="text-sm text-slate-600 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
            {showDate ? formatDateLabel(appointment.date) : "Today"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            {formatTime(appointment.startTime)}
          </span>
          {appointment.department?.name ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {appointment.department.name}
            </span>
          ) : null}
        </p>
        {appointment.reason ? (
          <p className="text-xs text-slate-500 mt-1">
            Reason: {appointment.reason}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {canCheckIn ? (
          <Button
            size="sm"
            variant="success"
            loading={busy}
            onClick={() => onCheckIn(appointment)}
          >
            <CheckCircle2 className="w-4 h-4" />
            Check in
          </Button>
        ) : null}
        {canCancel ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => onCancel(appointment)}
          >
            <XCircle className="w-4 h-4" />
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}
