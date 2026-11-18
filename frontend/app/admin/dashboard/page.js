"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  Pencil,
  Plus,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserCog,
  UserPlus,
  UserX,
  Users,
  X,
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
  Spinner,
  StatCard,
  StatusBadge,
  inputClass,
} from "@/components/ui";
import { apiRequest, formatDateInput, formatDateTime } from "@/lib/api";
import ChatbotAnalyticsPanel from "@/components/ChatbotAnalyticsPanel";
import { useUser } from "@/lib/useUser";

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "doctors", label: "Doctors", icon: Stethoscope },
  { key: "departments", label: "Departments", icon: Building2 },
  { key: "patients", label: "Patients", icon: Users },
  { key: "staff", label: "Staff", icon: UserCog },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "chatbot", label: "Chatbot analytics", icon: Bot },
  { key: "audit", label: "Audit logs", icon: ScrollText },
];

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const EMPTY_DEPARTMENT = { name: "", description: "", location: "" };
const EMPTY_STAFF = {
  name: "",
  email: "",
  phone: "",
  password: "",
  role: "receptionist",
};

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDateInput(date);
}

function availabilityFor(profile) {
  const existing = new Map(
    (profile?.availability || []).map((item) => [item.day, item])
  );

  return DAYS.map((day) => {
    const found = existing.get(day);
    return {
      day,
      available: Boolean(found),
      startTime: found?.startTime || "09:00",
      endTime: found?.endTime || "17:00",
    };
  });
}

export default function AdminDashboard() {
  const { user, loading, error: userError } = useUser({
    allowedRoles: ["admin"],
  });

  const [tab, setTab] = useState("overview");
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState("");

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [range, setRange] = useState({
    from: daysAgo(30),
    to: formatDateInput(),
  });

  const [departmentForm, setDepartmentForm] = useState(EMPTY_DEPARTMENT);
  const [creatingDepartment, setCreatingDepartment] = useState(false);

  const [staffForm, setStaffForm] = useState(EMPTY_STAFF);
  const [creatingStaff, setCreatingStaff] = useState(false);

  const [editingDoctor, setEditingDoctor] = useState(null);
  const [doctorForm, setDoctorForm] = useState(null);
  const [savingDoctor, setSavingDoctor] = useState(false);

  function flash(type, text) {
    setNotice({ type, text });
  }

  const loadUsers = useCallback(async () => {
    const data = await apiRequest("/api/admin/users");
    setUsers(data.users || []);
  }, []);

  const loadDepartments = useCallback(async () => {
    const data = await apiRequest("/api/departments");
    setDepartments(data.departments || []);
  }, []);

  const loadPatients = useCallback(async () => {
    const data = await apiRequest("/api/admin/patients");
    setPatients(data.patients || []);
  }, []);

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const data = await apiRequest(
        `/api/reports/summary?from=${range.from}&to=${range.to}`
      );
      setReport(data);
    } catch (error) {
      flash("error", error.message);
    } finally {
      setReportLoading(false);
    }
  }, [range.from, range.to]);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const data = await apiRequest("/api/admin/audit-logs?limit=150");
      setAuditLogs(data.logs || []);
    } catch (error) {
      flash("error", error.message);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    Promise.allSettled([loadUsers(), loadDepartments(), loadPatients()]);
  }, [user, loadUsers, loadDepartments, loadPatients]);

  useEffect(() => {
    if (!user) return;
    loadReport();
  }, [user, loadReport]);

  useEffect(() => {
    if (tab === "audit" && user) loadAudit();
  }, [tab, user, loadAudit]);

  const doctors = useMemo(
    () => users.filter((item) => item.role === "doctor"),
    [users]
  );
  const staff = useMemo(
    () =>
      users.filter((item) =>
        ["receptionist", "staff", "admin"].includes(item.role)
      ),
    [users]
  );
  const pendingUsers = useMemo(
    () => users.filter((item) => item.status === "pending"),
    [users]
  );

  async function runAction(key, action, successMessage) {
    setBusy(key);
    try {
      await action();
      flash("success", successMessage);
    } catch (error) {
      flash("error", error.message);
    } finally {
      setBusy("");
    }
  }

  function approveUser(target) {
    runAction(
      `approve-${target._id}`,
      async () => {
        await apiRequest(`/api/admin/users/${target._id}/approve`, {
          method: "PATCH",
        });
        await loadUsers();
      },
      `${target.name} approved.`
    );
  }

  function rejectUser(target) {
    runAction(
      `reject-${target._id}`,
      async () => {
        await apiRequest(`/api/admin/users/${target._id}/reject`, {
          method: "PATCH",
        });
        await loadUsers();
      },
      `${target.name} rejected.`
    );
  }

  async function createDepartment(event) {
    event.preventDefault();
    setCreatingDepartment(true);
    try {
      const data = await apiRequest("/api/departments", {
        method: "POST",
        body: departmentForm,
      });
      flash("success", data.message || "Department created.");
      setDepartmentForm(EMPTY_DEPARTMENT);
      await loadDepartments();
    } catch (error) {
      flash("error", error.message);
    } finally {
      setCreatingDepartment(false);
    }
  }

  async function deactivateDepartment(department) {
    if (
      !window.confirm(
        `Deactivate ${department.name}? It will no longer be available for new bookings.`
      )
    ) {
      return;
    }
    setBusy(`dept-${department._id}`);
    try {
      await apiRequest(`/api/departments/${department._id}`, {
        method: "DELETE",
      });
      flash("success", `${department.name} deactivated.`);
      await loadDepartments();
    } catch (error) {
      flash("error", error.message);
    } finally {
      setBusy("");
    }
  }

  async function createStaff(event) {
    event.preventDefault();
    setCreatingStaff(true);
    try {
      const data = await apiRequest("/api/admin/staff", {
        method: "POST",
        body: staffForm,
      });
      flash("success", data.message || "Staff account created.");
      setStaffForm(EMPTY_STAFF);
      await loadUsers();
    } catch (error) {
      flash("error", error.message);
    } finally {
      setCreatingStaff(false);
    }
  }

  function openDoctorEditor(doctor) {
    const profile = doctor.doctorProfile;
    setEditingDoctor(doctor);
    setDoctorForm({
      specialty: doctor.specialty || "",
      department: profile?.department?._id || doctor.department?._id || "",
      avgConsultationMinutes: profile?.avgConsultationMinutes ?? 10,
      consultationFee: profile?.consultationFee ?? 0,
      dailyPatientCapacity: profile?.dailyPatientCapacity ?? 20,
      isAvailable: profile?.isAvailable ?? true,
      verificationStatus: profile?.verificationStatus ?? "pending",
      availability: availabilityFor(profile),
    });
  }

  function updateAvailability(index, field, value) {
    setDoctorForm((prev) => ({
      ...prev,
      availability: prev.availability.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  async function saveDoctor(event) {
    event.preventDefault();
    if (!editingDoctor || !doctorForm) return;

    setSavingDoctor(true);
    try {
      await apiRequest(`/api/admin/users/${editingDoctor._id}`, {
        method: "PATCH",
        body: { specialty: doctorForm.specialty },
      });

      await apiRequest(`/api/admin/doctors/${editingDoctor._id}/schedule`, {
        method: "PATCH",
        body: {
          department: doctorForm.department || undefined,
          avgConsultationMinutes: Number(doctorForm.avgConsultationMinutes),
          consultationFee: Number(doctorForm.consultationFee),
          dailyPatientCapacity: Number(doctorForm.dailyPatientCapacity),
          isAvailable: doctorForm.isAvailable,
          verificationStatus: doctorForm.verificationStatus,
          availability: doctorForm.availability
            .filter((item) => item.available)
            .map((item) => ({
              day: item.day,
              startTime: item.startTime,
              endTime: item.endTime,
            })),
        },
      });

      flash("success", `${editingDoctor.name}'s profile was updated.`);
      setEditingDoctor(null);
      setDoctorForm(null);
      await loadUsers();
    } catch (error) {
      flash("error", error.message);
    } finally {
      setSavingDoctor(false);
    }
  }

  if (loading) return <PageLoader label="Loading admin console..." />;
  if (userError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <AlertBanner type="error">{userError}</AlertBanner>
      </div>
    );
  }
  if (!user) return null;

  const totals = report?.totals;
  const maxPeak = Math.max(
    ...(report?.peakHours || []).map((item) => item.count),
    1
  );
  const maxDaily = Math.max(
    ...(report?.dailyTrend || []).map((item) => item.count),
    1
  );

  return (
    <AppShell
      user={user}
      roleLabel="Administrator"
      title="Admin console"
      subtitle="Manage people, schedules, reports and compliance."
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      actions={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            loadUsers();
            loadDepartments();
            loadPatients();
            loadReport();
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

        {tab === "overview" ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="Appointments"
                value={totals?.appointments ?? "—"}
                hint={`Last 30 days`}
                icon={CalendarDays}
                tone="blue"
              />
              <StatCard
                label="Completed"
                value={totals?.completed ?? "—"}
                hint="Visits finished"
                icon={CheckCircle2}
                tone="green"
              />
              <StatCard
                label="Avg wait"
                value={
                  report ? `${report.averages.waitMinutes}m` : "—"
                }
                hint="Checked in → consultation"
                icon={Clock}
                tone="amber"
              />
              <StatCard
                label="No-show rate"
                value={totals ? `${totals.noShowRate}%` : "—"}
                hint={`${totals?.noShow ?? 0} no-shows`}
                icon={UserX}
                tone="red"
              />
            </div>

            <div className="grid lg:grid-cols-3 gap-3">
              <Card className="p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Doctors
                </p>
                <p className="text-3xl font-extrabold text-slate-900 mt-2">
                  {doctors.length}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 -ml-3"
                  onClick={() => setTab("doctors")}
                >
                  Manage doctors
                </Button>
              </Card>
              <Card className="p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Departments
                </p>
                <p className="text-3xl font-extrabold text-slate-900 mt-2">
                  {departments.length}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 -ml-3"
                  onClick={() => setTab("departments")}
                >
                  Manage departments
                </Button>
              </Card>
              <Card className="p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Patients
                </p>
                <p className="text-3xl font-extrabold text-slate-900 mt-2">
                  {patients.length}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 -ml-3"
                  onClick={() => setTab("patients")}
                >
                  View patients
                </Button>
              </Card>
            </div>

            <Card>
              <CardHeader
                title="Pending approvals"
                subtitle="Doctor and staff accounts waiting for activation."
                action={<Badge tone="amber">{pendingUsers.length} pending</Badge>}
              />
              {pendingUsers.length === 0 ? (
                <EmptyState
                  icon={ShieldCheck}
                  title="Nothing to review"
                  description="New doctor and staff registrations will appear here."
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {pendingUsers.map((pending) => (
                    <div
                      key={pending._id}
                      className="px-5 py-3 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {pending.name}{" "}
                          <span className="text-xs font-normal text-slate-500 capitalize">
                            ({pending.role})
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {pending.email} · {pending.phone}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="success"
                          loading={busy === `approve-${pending._id}`}
                          onClick={() => approveUser(pending)}
                        >
                          <Check className="w-4 h-4" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={busy === `reject-${pending._id}`}
                          onClick={() => rejectUser(pending)}
                        >
                          <X className="w-4 h-4" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Recent activity"
                subtitle="Appointment volume across the last 30 days."
              />
              <div className="px-5 pb-5">
                {!report || report.dailyTrend.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No activity recorded yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {report.dailyTrend.slice(-10).map((item) => (
                      <div key={item.date} className="flex items-center gap-3">
                        <span className="w-24 text-xs font-medium text-slate-500">
                          {item.date}
                        </span>
                        <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${(item.count / maxDaily) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-xs font-bold text-slate-700">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </>
        ) : null}

        {tab === "doctors" ? (
          <Card>
            <CardHeader
              title="Doctors"
              subtitle="Approve accounts and edit departments, fees and weekly schedules."
              action={<Badge tone="blue">{doctors.length} doctors</Badge>}
            />
            {doctors.length === 0 ? (
              <EmptyState
                icon={Stethoscope}
                title="No doctors yet"
                description="Doctors appear here after registration."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Doctor</th>
                      <th className="px-5 py-3 font-semibold">Department</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 font-semibold">Verification</th>
                      <th className="px-5 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {doctors.map((doctor) => (
                      <tr key={doctor._id}>
                        <td className="px-5 py-3">
                          <p className="font-semibold text-slate-900">
                            {doctor.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {doctor.specialty || "—"} · {doctor.email}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {doctor.doctorProfile?.department?.name ||
                            doctor.department?.name ||
                            "—"}
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={doctor.status} />
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge
                            status={
                              doctor.doctorProfile?.verificationStatus ||
                              "pending"
                            }
                          />
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {doctor.status === "pending" ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="success"
                                  loading={busy === `approve-${doctor._id}`}
                                  onClick={() => approveUser(doctor)}
                                >
                                  <Check className="w-4 h-4" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  loading={busy === `reject-${doctor._id}`}
                                  onClick={() => rejectUser(doctor)}
                                >
                                  <X className="w-4 h-4" />
                                  Reject
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openDoctorEditor(doctor)}
                              >
                                <Pencil className="w-4 h-4" />
                                Schedule
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : null}

        {tab === "departments" ? (
          <div className="grid lg:grid-cols-3 gap-5">
            <Card className="lg:col-span-1">
              <CardHeader title="New department" subtitle="Add a clinical unit." />
              <form onSubmit={createDepartment} className="px-5 pb-5 space-y-3">
                <Field label="Name">
                  <input
                    value={departmentForm.name}
                    onChange={(event) =>
                      setDepartmentForm((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                    required
                    className={inputClass}
                    placeholder="e.g. Neurology"
                  />
                </Field>
                <Field label="Location">
                  <input
                    value={departmentForm.location}
                    onChange={(event) =>
                      setDepartmentForm((prev) => ({
                        ...prev,
                        location: event.target.value,
                      }))
                    }
                    className={inputClass}
                    placeholder="e.g. Second floor - Block D"
                  />
                </Field>
                <Field label="Description">
                  <textarea
                    rows={3}
                    value={departmentForm.description}
                    onChange={(event) =>
                      setDepartmentForm((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    className={`${inputClass} resize-none`}
                    placeholder="What this department treats"
                  />
                </Field>
                <Button type="submit" loading={creatingDepartment} className="w-full">
                  <Plus className="w-4 h-4" />
                  Create department
                </Button>
              </form>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader
                title="Departments"
                subtitle="Deactivated departments stay in historical records."
                action={<Badge tone="blue">{departments.length} active</Badge>}
              />
              {departments.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="No departments yet"
                  description="Create your first department on the left."
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {departments.map((department) => (
                    <div
                      key={department._id}
                      className="px-5 py-3 flex flex-wrap items-start justify-between gap-3"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {department.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {department.location || "No location"} ·{" "}
                          {department.doctorCount || 0} doctor
                          {department.doctorCount === 1 ? "" : "s"}
                        </p>
                        {department.description ? (
                          <p className="text-xs text-slate-500 mt-1 max-w-xl">
                            {department.description}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busy === `dept-${department._id}`}
                        onClick={() => deactivateDepartment(department)}
                      >
                        <Trash2 className="w-4 h-4" />
                        Deactivate
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : null}

        {tab === "patients" ? (
          <Card>
            <CardHeader
              title="Patients"
              subtitle="Registered patient accounts. Medical data stays encrypted."
              action={<Badge tone="blue">{patients.length} patients</Badge>}
            />
            {patients.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No patients yet"
                description="Patient registrations and walk-ins will appear here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Patient</th>
                      <th className="px-5 py-3 font-semibold">Contact</th>
                      <th className="px-5 py-3 font-semibold">Blood group</th>
                      <th className="px-5 py-3 font-semibold">Consent</th>
                      <th className="px-5 py-3 font-semibold">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {patients.map((patient) => (
                      <tr key={patient._id}>
                        <td className="px-5 py-3">
                          <p className="font-semibold text-slate-900">
                            {patient.name}
                          </p>
                          <p className="text-xs text-slate-500">{patient.email}</p>
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {patient.phone}
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {patient.patientProfile?.bloodGroup || "—"}
                        </td>
                        <td className="px-5 py-3">
                          {patient.consentAccepted ? (
                            <Badge tone="green">Accepted</Badge>
                          ) : (
                            <Badge tone="amber">Pending</Badge>
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {formatDateTime(patient.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : null}

        {tab === "staff" ? (
          <div className="grid lg:grid-cols-3 gap-5">
            <Card className="lg:col-span-1">
              <CardHeader
                title="Create staff account"
                subtitle="Receptionists, staff and admins."
              />
              <form onSubmit={createStaff} className="px-5 pb-5 space-y-3">
                <Field label="Full name">
                  <input
                    value={staffForm.name}
                    onChange={(event) =>
                      setStaffForm((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                    required
                    className={inputClass}
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={staffForm.email}
                    onChange={(event) =>
                      setStaffForm((prev) => ({
                        ...prev,
                        email: event.target.value,
                      }))
                    }
                    required
                    className={inputClass}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    value={staffForm.phone}
                    onChange={(event) =>
                      setStaffForm((prev) => ({
                        ...prev,
                        phone: event.target.value,
                      }))
                    }
                    required
                    className={inputClass}
                  />
                </Field>
                <Field label="Role">
                  <select
                    value={staffForm.role}
                    onChange={(event) =>
                      setStaffForm((prev) => ({
                        ...prev,
                        role: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="receptionist">Receptionist</option>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </Field>
                <Field label="Temporary password" hint="At least 8 characters.">
                  <input
                    type="password"
                    value={staffForm.password}
                    onChange={(event) =>
                      setStaffForm((prev) => ({
                        ...prev,
                        password: event.target.value,
                      }))
                    }
                    required
                    minLength={8}
                    className={inputClass}
                  />
                </Field>
                <Button type="submit" loading={creatingStaff} className="w-full">
                  <UserPlus className="w-4 h-4" />
                  Create account
                </Button>
              </form>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader
                title="Staff accounts"
                subtitle="Admins, receptionists and support staff."
                action={<Badge tone="blue">{staff.length} accounts</Badge>}
              />
              <div className="divide-y divide-slate-100">
                {staff.map((member) => (
                  <div
                    key={member._id}
                    className="px-5 py-3 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {member.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {member.email} · {member.phone}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone="violet">{member.role}</Badge>
                      <StatusBadge status={member.status} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : null}

        {tab === "reports" ? (
          <div className="space-y-5">
            <Card className="p-4">
              <div className="flex flex-wrap items-end gap-3">
                <Field label="From">
                  <input
                    type="date"
                    value={range.from}
                    onChange={(event) =>
                      setRange((prev) => ({ ...prev, from: event.target.value }))
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="To">
                  <input
                    type="date"
                    value={range.to}
                    onChange={(event) =>
                      setRange((prev) => ({ ...prev, to: event.target.value }))
                    }
                    className={inputClass}
                  />
                </Field>
                <Button onClick={loadReport} loading={reportLoading}>
                  <BarChart3 className="w-4 h-4" />
                  Generate report
                </Button>
              </div>
            </Card>

            {reportLoading && !report ? (
              <Spinner label="Building report..." />
            ) : report ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatCard
                    label="Appointments"
                    value={report.totals.appointments}
                    hint={`${report.range.from} → ${report.range.to}`}
                    icon={CalendarDays}
                    tone="blue"
                  />
                  <StatCard
                    label="Avg wait"
                    value={`${report.averages.waitMinutes}m`}
                    hint="Checked in → started"
                    icon={Clock}
                    tone="amber"
                  />
                  <StatCard
                    label="Avg consultation"
                    value={`${report.averages.consultationMinutes}m`}
                    hint="Started → completed"
                    icon={Activity}
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

                <div className="grid lg:grid-cols-2 gap-5">
                  <Card>
                    <CardHeader
                      title="Peak hours"
                      subtitle="Appointments by start hour."
                    />
                    <div className="px-5 pb-5 space-y-2">
                      {report.peakHours.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          No appointments in this range.
                        </p>
                      ) : (
                        report.peakHours.map((item) => (
                          <div key={item.hour} className="flex items-center gap-3">
                            <span className="w-16 text-xs font-semibold text-slate-500">
                              {item.hour}
                            </span>
                            <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-blue-500"
                                style={{
                                  width: `${(item.count / maxPeak) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="w-8 text-right text-xs font-bold text-slate-700">
                              {item.count}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>

                  <Card>
                    <CardHeader
                      title="No-show overview"
                      subtitle="Booked, cancelled and missed appointments."
                    />
                    <div className="px-5 pb-5 space-y-3">
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-xl bg-emerald-50 px-3 py-3">
                          <p className="text-2xl font-extrabold text-emerald-700">
                            {report.totals.completed}
                          </p>
                          <p className="text-xs text-emerald-700">Completed</p>
                        </div>
                        <div className="rounded-xl bg-slate-100 px-3 py-3">
                          <p className="text-2xl font-extrabold text-slate-700">
                            {report.totals.cancelled}
                          </p>
                          <p className="text-xs text-slate-600">Cancelled</p>
                        </div>
                        <div className="rounded-xl bg-rose-50 px-3 py-3">
                          <p className="text-2xl font-extrabold text-rose-700">
                            {report.totals.noShow}
                          </p>
                          <p className="text-xs text-rose-700">No-shows</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">
                        {report.totals.queueEntries} tokens issued in this period.
                      </p>
                    </div>
                  </Card>
                </div>

                <Card>
                  <CardHeader
                    title="Patient load per doctor"
                    subtitle="Appointment volume for each doctor."
                  />
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-5 py-3 font-semibold">Doctor</th>
                          <th className="px-5 py-3 font-semibold">Appointments</th>
                          <th className="px-5 py-3 font-semibold">Completed</th>
                          <th className="px-5 py-3 font-semibold">Load</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report.doctorLoad.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-5 py-6 text-center text-slate-500"
                            >
                              No appointments in this range.
                            </td>
                          </tr>
                        ) : (
                          report.doctorLoad.map((row) => (
                            <tr key={row.doctorId}>
                              <td className="px-5 py-3 font-medium text-slate-900">
                                {row.name}
                              </td>
                              <td className="px-5 py-3 text-slate-600">
                                {row.total}
                              </td>
                              <td className="px-5 py-3 text-slate-600">
                                {row.completed}
                              </td>
                              <td className="px-5 py-3">
                                <div className="h-2 w-32 rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-blue-500"
                                    style={{
                                      width: `${(row.total / Math.max(report.doctorLoad[0].total, 1)) * 100}%`,
                                    }}
                                  />
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card>
                  <CardHeader
                    title="Daily trend"
                    subtitle="Appointments booked each day."
                  />
                  <div className="px-5 pb-5 space-y-2 max-h-72 overflow-y-auto">
                    {report.dailyTrend.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No appointments in this range.
                      </p>
                    ) : (
                      report.dailyTrend.map((item) => (
                        <div key={item.date} className="flex items-center gap-3">
                          <span className="w-24 text-xs font-medium text-slate-500">
                            {item.date}
                          </span>
                          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{
                                width: `${(item.count / maxDaily) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="w-8 text-right text-xs font-bold text-slate-700">
                            {item.count}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </>
            ) : null}
          </div>
        ) : null}

        {tab === "audit" ? (
          <Card>
            <CardHeader
              title="Audit logs"
              subtitle="Every state-changing request is recorded and retained for 180 days."
              action={<Badge tone="violet">HIPAA / GDPR trail</Badge>}
            />
            {auditLoading ? (
              <Spinner label="Loading audit logs..." />
            ) : auditLogs.length === 0 ? (
              <EmptyState
                icon={ScrollText}
                title="No audit entries yet"
                description="Actions such as bookings, check-ins and profile changes will be logged here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Time</th>
                      <th className="px-5 py-3 font-semibold">Actor</th>
                      <th className="px-5 py-3 font-semibold">Action</th>
                      <th className="px-5 py-3 font-semibold">Entity</th>
                      <th className="px-5 py-3 font-semibold">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log._id}>
                        <td className="px-5 py-3 whitespace-nowrap text-slate-600">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-900">
                            {log.actor?.name || "System"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {log.actor?.role || log.actorRole || "—"}
                          </p>
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-700">
                          {log.action}
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {log.entity || "—"}
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-500">
                          {log.ip || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : null}

        {tab === "chatbot" ? <ChatbotAnalyticsPanel /> : null}
      </div>

      <Modal
        open={Boolean(editingDoctor && doctorForm)}
        onClose={() => {
          setEditingDoctor(null);
          setDoctorForm(null);
        }}
        title="Edit doctor profile"
        subtitle={editingDoctor?.name}
        wide
      >
        {doctorForm ? (
          <form onSubmit={saveDoctor} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Specialty">
                <input
                  value={doctorForm.specialty}
                  onChange={(event) =>
                    setDoctorForm((prev) => ({
                      ...prev,
                      specialty: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Department">
                <select
                  value={doctorForm.department}
                  onChange={(event) =>
                    setDoctorForm((prev) => ({
                      ...prev,
                      department: event.target.value,
                    }))
                  }
                  className={inputClass}
                >
                  <option value="">Unassigned</option>
                  {departments.map((department) => (
                    <option key={department._id} value={department._id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Avg consultation (minutes)">
                <input
                  type="number"
                  min="1"
                  value={doctorForm.avgConsultationMinutes}
                  onChange={(event) =>
                    setDoctorForm((prev) => ({
                      ...prev,
                      avgConsultationMinutes: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Consultation fee (₹)">
                <input
                  type="number"
                  min="0"
                  value={doctorForm.consultationFee}
                  onChange={(event) =>
                    setDoctorForm((prev) => ({
                      ...prev,
                      consultationFee: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Daily capacity">
                <input
                  type="number"
                  min="1"
                  value={doctorForm.dailyPatientCapacity}
                  onChange={(event) =>
                    setDoctorForm((prev) => ({
                      ...prev,
                      dailyPatientCapacity: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Verification">
                <select
                  value={doctorForm.verificationStatus}
                  onChange={(event) =>
                    setDoctorForm((prev) => ({
                      ...prev,
                      verificationStatus: event.target.value,
                    }))
                  }
                  className={inputClass}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </Field>
            </div>

            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={doctorForm.isAvailable}
                onChange={(event) =>
                  setDoctorForm((prev) => ({
                    ...prev,
                    isAvailable: event.target.checked,
                  }))
                }
                className="h-4 w-4 accent-blue-600"
              />
              Accepting new appointments
            </label>

            <div>
              <p className="text-sm font-semibold text-slate-800 mb-2">
                Weekly schedule
              </p>
              <div className="space-y-2">
                {doctorForm.availability.map((item, index) => (
                  <div
                    key={item.day}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-slate-200 p-3"
                  >
                    <label className="flex items-center gap-2 sm:w-36 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={item.available}
                        onChange={(event) =>
                          updateAvailability(index, "available", event.target.checked)
                        }
                        className="h-4 w-4 accent-blue-600"
                      />
                      {item.day}
                    </label>
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        value={item.startTime}
                        disabled={!item.available}
                        onChange={(event) =>
                          updateAvailability(index, "startTime", event.target.value)
                        }
                        className={`${inputClass} disabled:bg-slate-100`}
                      />
                      <span className="text-xs text-slate-400">to</span>
                      <input
                        type="time"
                        value={item.endTime}
                        disabled={!item.available}
                        onChange={(event) =>
                          updateAvailability(index, "endTime", event.target.value)
                        }
                        className={`${inputClass} disabled:bg-slate-100`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditingDoctor(null);
                  setDoctorForm(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={savingDoctor}>
                Save changes
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </AppShell>
  );
}
