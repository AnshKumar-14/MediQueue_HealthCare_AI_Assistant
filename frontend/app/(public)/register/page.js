'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Stethoscope } from 'lucide-react';
import { apiRequest } from '@/lib/api';

// ---- Small inline icons (no external icon package assumed) ----
const StethoscopeIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path d="M4.5 3v6a3.5 3.5 0 0 0 7 0V3" strokeLinecap="round" />
    <path d="M8 12.5V15a5 5 0 0 0 10 0v-2" strokeLinecap="round" />
    <circle cx="19" cy="17" r="2" />
  </svg>
);
const QueueIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <rect x="3" y="6" width="12" height="12" rx="2" />
    <path d="M18 9l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CalendarIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    <path d="M12 14v4M10 16h4" strokeLinecap="round" />
  </svg>
);
const BellIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" />
  </svg>
);
const UserIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5" strokeLinecap="round" />
  </svg>
);
const StaffIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <circle cx="8.5" cy="8" r="3" />
    <circle cx="16" cy="9" r="2.5" />
    <path d="M2.5 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
    <path d="M14.5 14.2c2.5.3 4.5 2.4 4.5 5.3" strokeLinecap="round" />
  </svg>
);

const ROLES = [
  { key: 'patient', label: 'Patient', icon: UserIcon },
  { key: 'doctor', label: 'Doctor', icon: StethoscopeIcon },
  { key: 'staff', label: 'Staff', icon: StaffIcon },
];

const SPECIALTIES = [
  'General Physician',
  'Cardiology',
  'Dermatology',
  'Pediatrics',
  'Orthopedics',
  'ENT',
  'Gynecology',
  'Psychiatry',
];

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState('patient');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    specialty: SPECIALTIES[0],
    licenseNumber: '',
    staffType: 'receptionist',
    dateOfBirth: '',
    gender: '',
    bloodGroup: '',
    address: '',
    emergencyContact: '',
    allergies: '',
    conditions: '',
    medications: '',
    consentAccepted: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // 
  
  async function handleSubmit(e) {
  e.preventDefault();

  setError("");

  if (form.password !== form.confirmPassword) {
    setError("Passwords do not match");
    return;
  }

  if (form.password.length < 8) {
    setError("Password must be at least 8 characters");
    return;
  }

  if (role === "doctor" && !form.licenseNumber.trim()) {
    setError("Medical license number is required for doctor accounts");
    return;
  }

  if (role === "patient" && !form.consentAccepted) {
    setError("Please accept the privacy consent to create a patient account");
    return;
  }

  setLoading(true);

  try {
    const payload = {
      role: role,
      name: form.name,
      email: form.email.trim(),
      phone: form.phone,
      password: form.password,

      ...(role === "doctor" && {
        specialty: form.specialty,
        licenseNumber: form.licenseNumber,
      }),

      ...(role === "staff" && {
        staffType: form.staffType,
      }),

      ...(role === "patient" && {
        consentAccepted: form.consentAccepted,
        patientProfile: {
          dateOfBirth: form.dateOfBirth,
          gender: form.gender,
          bloodGroup: form.bloodGroup,
          address: form.address,
          emergencyContact: form.emergencyContact,
        },
        medicalInfo: {
          bloodGroup: form.bloodGroup,
          allergies: form.allergies,
          conditions: form.conditions,
          medications: form.medications,
        },
      }),
    };

    await apiRequest("/api/auth/register", {
      method: "POST",
      body: payload,
    });

    router.push("/login");

    // This is for checking if the admin has approved for the profile of other than Patient, patients don't need profile approval
    // if (role === "patient") {
    //   router.push("/login?registered=1");
    // } else {
    //   router.push("/login?pendingApproval=1");
    // }
  } catch (err) {
    setError(err.message || "Registration failed");
  } finally {
    setLoading(false);
  }
}

  const ActiveRoleIcon = ROLES.find((r) => r.key === role).icon;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl overflow-hidden grid md:grid-cols-2">

        {/* Left panel — brand + feature highlights, matches login page */}
        <div className="relative hidden md:flex flex-col justify-between p-10 bg-linear-to-br from-blue-50 to-slate-50 overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, #1d4ed8 0, #1d4ed8 2px, transparent 2px, transparent 40px)',
            }}
          />
          <div className="relative">
            <div className="flex items-center gap-2 mb-10">
              <Stethoscope className="w-7 h-7 text-blue-600" />
              <span className="text-xl font-bold text-slate-900">
                Medi<span className="text-blue-600">Queue</span>
              </span>
            </div>

            <h1 className="text-4xl font-extrabold text-slate-900 leading-tight mb-4">
              Join in a few
              <br />
              simple steps
            </h1>
            <p className="text-slate-600 leading-relaxed max-w-sm">
              Create your account to book appointments, track your queue position, and get
              notified the moment it&apos;s your turn.
            </p>
          </div>

          <div className="relative space-y-4 mt-10">
            <Feature icon={QueueIcon} title="Live Queue Tracking" desc="See real-time queue positions" iconColor="text-blue-600" />
            <Feature icon={CalendarIcon} title="Appointment Management" desc="Book, reschedule and manage easily" iconColor="text-emerald-600" />
            <Feature icon={BellIcon} title="Smart Notifications" desc="Get notified when it's your turn" iconColor="text-rose-500" />
          </div>
        </div>

        {/* Right panel — form */}
        <div className="p-8 sm:p-10 flex flex-col justify-center">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl border border-slate-200 flex items-center justify-center mb-3">
              <ActiveRoleIcon className="w-7 h-7 text-blue-600" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900">Create Account</h2>
            <p className="text-sm text-slate-500 mt-1">Register to get started with MediQueue</p>
          </div>

          {/* Role tabs */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {ROLES.map(({ key, label, icon: Icon }) => {
              const active = role === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRole(key)}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              );
            })}
          </div>

          {role !== 'patient' && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-5">
              {role === 'doctor' ? 'Doctor' : 'Staff'} accounts are reviewed by an admin before
              activation. You&apos;ll be notified once approved.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label={`${roleLabel(role)}'s Full Name`}>
              <input
                type="text"
                placeholder="Name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                required
                className={inputClass}
              />
            </Field>

            <Field label={`${roleLabel(role)}'s Email`}>
              <input
                type="email"
                placeholder="name@example.com"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                required
                className={inputClass}
              />
            </Field>

            <Field label="Phone Number">
              <input
                type="tel"
                placeholder="1234567890"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                required
                className={inputClass}
              />
            </Field>

            {role === 'patient' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date of Birth">
                    <input
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(e) => update('dateOfBirth', e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Gender">
                    <select
                      value={form.gender}
                      onChange={(e) => update('gender', e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Prefer not to say</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Blood Group">
                    <input
                      type="text"
                      placeholder="e.g. O+"
                      value={form.bloodGroup}
                      onChange={(e) => update('bloodGroup', e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Emergency Contact">
                    <input
                      type="tel"
                      placeholder="Phone number"
                      value={form.emergencyContact}
                      onChange={(e) => update('emergencyContact', e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                </div>

                <Field label="Address">
                  <textarea
                    rows={2}
                    placeholder="Home address"
                    value={form.address}
                    onChange={(e) => update('address', e.target.value)}
                    className={`${inputClass} resize-none`}
                  />
                </Field>

                <div className="rounded-xl border border-slate-200 p-3 space-y-3">
                  <p className="text-sm font-semibold text-slate-800">
                    Medical information <span className="text-xs font-normal text-slate-500">(encrypted)</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Allergies">
                      <input
                        type="text"
                        placeholder="e.g. Penicillin"
                        value={form.allergies}
                        onChange={(e) => update('allergies', e.target.value)}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Existing Conditions">
                      <input
                        type="text"
                        placeholder="e.g. Hypertension"
                        value={form.conditions}
                        onChange={(e) => update('conditions', e.target.value)}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  <Field label="Current Medications">
                    <input
                      type="text"
                      placeholder="e.g. Amlodipine 5mg"
                      value={form.medications}
                      onChange={(e) => update('medications', e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                </div>
              </>
            )}

            {role === 'doctor' && (
              <>
                <Field label="Specialty">
                  <select
                    value={form.specialty}
                    onChange={(e) => update('specialty', e.target.value)}
                    className={inputClass}
                  >
                    {SPECIALTIES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Medical License Number">
                  <input
                    type="text"
                    placeholder="e.g. MED-2024-00123"
                    value={form.licenseNumber}
                    onChange={(e) => update('licenseNumber', e.target.value)}
                    required
                    className={inputClass}
                  />
                </Field>
              </>
            )}

            {role === 'staff' && (
              <Field label="Staff Type">
                <select
                  value={form.staffType}
                  onChange={(e) => update('staffType', e.target.value)}
                  className={inputClass}
                >
                  <option value="receptionist">Receptionist</option>
                  <option value="admin">Admin</option>
                </select>
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Password">
                <input
                  type="password"
                  placeholder="Password"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  required
                  className={inputClass}
                />
              </Field>
              <Field label="Confirm Password">
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={form.confirmPassword}
                  onChange={(e) => update('confirmPassword', e.target.value)}
                  required
                  className={inputClass}
                />
              </Field>
            </div>

            {role === 'patient' && (
              <label className="flex items-start gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={form.consentAccepted}
                  onChange={(e) => update('consentAccepted', e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-blue-600"
                />
                <span>
                  I consent to MediQueue storing my medical information to
                  coordinate my care. I understand I can update or export my data
                  at any time.
                </span>
              </label>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-xl py-3 mt-2 transition-colors"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 font-medium hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function roleLabel(role) {
  if (role === 'doctor') return "Doctor";
  if (role === 'staff') return "Staff";
  return "Patient";
}

const inputClass =
  'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-slate-800 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function Feature({ icon: Icon, title, desc, iconColor }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
    </div>
  );
}
