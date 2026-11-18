'use client';

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Background from "@/public/images/background_medical.jpg";
import Stethoscope from "@/public/icons/stethoscopeIcon-Black.svg";
import Queue from "@/public/icons/queueIcon.svg"
import Appointment from "@/public/icons/appointmentIcon.svg"
import Notification from "@/public/icons/notificationIcon.svg"
import StethoscopeBlue from "@/public/icons/stethoscopeIcon-Blue.svg"
import Patient from "@/public/icons/patientIcon.svg"
import Staff from "@/public/icons/staffIcon.svg"
import Link from "next/link";
import { API_URL, apiRequest } from "@/lib/api";
import { dashboardPathFor, roleLabel as userRoleLabel } from "@/lib/useUser";

const ROLES = [
  { key: 'patient', label: 'Patient', icon: Patient },
  { key: 'doctor', label: 'Doctor', icon: StethoscopeBlue },
  { key: 'staff', label: 'Staff', icon: Staff },
];

const DEMO_ACCOUNTS = {
  patient: { email: 'patient@mediqueue.com', password: 'Patient@123' },
  doctor: { email: 'doctor@mediqueue.com', password: 'Doctor@123' },
  staff: { email: 'reception@mediqueue.com', password: 'Reception@123' },
  admin: { email: 'admin@mediqueue.com', password: 'Admin@123' },
};

function loginErrorMessage(err) {
  if (!err?.status) {
    return `Can't reach the server at ${API_URL}. Make sure the backend is running, then try again.`;
  }
  if (err.status === 401) {
    return "Incorrect email or password. Please try again.";
  }
  if (err.status === 403) {
    return err.message || "This account is not approved yet.";
  }
  if (err.status === 429) {
    return "Too many login attempts. Please wait a few minutes and try again.";
  }
  if (err.status >= 500) {
    return "The server ran into a problem. Please try again in a moment.";
  }
  return err.message || "Login failed. Please try again.";
}

const LoginPage = () => {

  const router = useRouter();
  const [role, setRole] = useState('patient');
  const [loading, setLoading] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [sessionUser, setSessionUser] = useState(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [form, setForm] = useState({
    email: '',
    password: '',
  });

  useEffect(() => {
    let active = true;

    apiRequest("/api/auth/me")
      .then((data) => {
        if (active && data?.user) {
          setSessionUser(data.user);
        }
      })
      .catch(() => {
        // No active session is the normal case on the login page.
      });

    return () => {
      active = false;
    };
  }, []);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function selectRole(nextRole) {
    setRole(nextRole);
    setError('');
    setInfo('');
  }

  function fillDemo(account = role) {
    const demo = DEMO_ACCOUNTS[account];
    if (!demo) return;

    setForm({ email: demo.email, password: demo.password });
    if (account !== 'admin') {
      setRole(account);
    }
    setError('');
    setInfo(`Demo ${userRoleLabel(account)} credentials filled in.`);
  }

  async function goToDashboard(user) {
    let destination = dashboardPathFor(user.role);

    if (user.role === 'doctor') {
      try {
        const profile = await apiRequest("/api/doctor/profile");
        if (!profile?.profileCompleted) {
          destination = "/doctor/complete-profile";
        }
      } catch (profileError) {
        if (profileError.status === 401) {
          setSessionUser(null);
          setError("Your session expired. Please sign in again.");
          return;
        }
        // A profile lookup failure should not block an otherwise valid login.
      }
    }

    router.replace(destination);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (loading) return;

    setError("");
    setInfo("");

    const email = form.email.trim();

    if (!email || !form.password) {
      setError("Enter your email and password to continue.");
      return;
    }

    setLoading(true);

    try {
      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: { email, password: form.password },
      });

      await goToDashboard(data.user);
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleContinue() {
    if (!sessionUser || continuing) return;

    setError("");
    setInfo("");
    setContinuing(true);

    try {
      await goToDashboard(sessionUser);
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setContinuing(false);
    }
  }

  async function handleSwitchAccount() {
    if (switching) return;

    setError("");
    setInfo("");
    setSwitching(true);

    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
      setSessionUser(null);
      setForm({ email: '', password: '' });
      setInfo("Signed out. You can sign in with another account.");
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setSwitching(false);
    }
  }

  return (
    <>
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative">
      <Image src={Background} alt="Background_Login" fill loading="eager" className=""/>
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl overflow-hidden grid md:grid-cols-2 z-1">

    {/* Left Panel */}
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
            <Image src={Stethoscope} alt="Stethoscope" width={60} height={60} className="w-7 h-7 text-blue-600"/>
            <span className="text-xl font-bold text-slate-900">Medi
            <span className="text-blue-600">Queue</span></span>
          </div>

          <div className="text-4xl font-extrabold text-slate-900 leading-tight mb-4">
            <span>Book Faster,</span>
            <br/>
            <span>Wait Less</span>
          </div>
            <span className="text-slate-600 leading-relaxed max-w-sm">Skip unnecessary waiting. Book appointments, track your queue position and get notified when it&apos;s almost your turn.</span>
        </div>

        <div className="relative space-y-4 mt-10">
          <div className="flex gap-3">
            <Image src={Queue} alt="Queue" width={35} height={35} className="h-9 w-9" />
            <span className="flex flex-col text-sm font-semibold text-slate-900">
              Live Queue Tracking
              <span className="text-xs text-slate-500 font-normal">See real-time queue positions</span>
            </span>
          </div>

          <div className="flex gap-3">
            <Image src={Appointment} alt="Appointment" width={35} height={35} className="h-9 w-9" />
            <span className="flex flex-col text-sm font-semibold text-slate-900">
              Appointment Management
              <span className="text-xs text-slate-500 font-normal">Book, reschedule and manage easily</span>
            </span>
          </div>

          <div className="flex gap-3">
            <Image src={Notification} alt="Notification" width={35} height={35} className="h-9 w-9" />
            <span className="flex flex-col text-sm font-semibold text-slate-900">
              Smart Notifications
              <span className="text-xs text-slate-500 font-normal">Get notified when it&apos;s your turn</span>
            </span>
          </div>
        </div>
      </div>

      {/* Login Form Starts From Here */}

      <div className="p-8 sm:p-10 flex flex-col justify-center z-1">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl border border-slate-200 flex items-center justify-center mb-3">
          {role == 'patient' && <Image src={Patient} alt="PatientIcon" width={30} height={30} className="h-[30px] w-[30px]"/>}
          {role == 'doctor' && <Image src={StethoscopeBlue} alt="StethoscopeIcon" width={30} height={30} className="h-[30px] w-[30px]"/>}
          {role == 'staff' && <Image src={Staff} alt="StaffIcon" width={30} height={30} className="h-[30px] w-[30px]"/>}
          </div>
          <span className="text-2xl font-extrabold text-slate-900">Welcome Back</span>
          <span className="text-sm text-slate-500 mt-1">Login to your account</span>
        </div>

        {sessionUser && (
          <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-sm">
            <p className="font-semibold text-slate-900">
              You&apos;re already signed in as {sessionUser.name}
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              {userRoleLabel(sessionUser.role)} · {sessionUser.email}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleContinue}
                disabled={continuing || switching}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {continuing ? 'Opening dashboard...' : 'Continue to dashboard'}
              </button>
              <button
                type="button"
                onClick={handleSwitchAccount}
                disabled={continuing || switching}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400 disabled:opacity-60"
              >
                {switching ? 'Signing out...' : 'Sign out & switch account'}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mb-2">
            {ROLES.map(({ key, label, icon: Icon }) => {
              const active = role === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectRole(key)}
                  aria-pressed={active}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-center items-center gap-2">
                  <Image src={Icon} alt={label} width={30} height={30} className="h-[30px] w-[30px]" />
                    {label}
                  </div>
                 </button>
              );
            })}
          </div>

        <p className="mb-5 text-center text-[11px] leading-relaxed text-slate-500">
          Pick a role to load its demo account. Your saved role still decides
          which dashboard opens after login.
        </p>

        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-700">
              Demo {userRoleLabel(role)} account
            </span>
            <button
              type="button"
              onClick={() => fillDemo(role)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-blue-600 transition-colors hover:border-blue-300"
            >
              Use demo
            </button>
          </div>
          <p className="mt-1.5 break-all font-mono text-[11px] text-slate-500">
            {DEMO_ACCOUNTS[role].email} · {DEMO_ACCOUNTS[role].password}
          </p>
          <button
            type="button"
            onClick={() => fillDemo('admin')}
            className="mt-1.5 text-[11px] font-semibold text-slate-500 underline-offset-2 hover:text-blue-600 hover:underline"
          >
            Use admin demo instead
          </button>
        </div>

        <div className="">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label={`${roleLabel(role)}'s Email Id`}>
              <input
                type="email"
                placeholder="name@example.com"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                required
                autoComplete="username"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                className={inputClass}
              />
            </Field>

            <Field label="Password">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  required
                  autoComplete="current-password"
                  className={`${inputClass} pr-16`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-700"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </Field>

            {error && (
              <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {info && (
              <p role="status" className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-xl py-3 mt-2 transition-colors"
            >
              {loading ? 'Logging In...' : 'Log In'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-blue-600 font-medium hover:underline">
              Sign Up
            </Link>
          </p>
      </div>
      </div>
    </main>
    </>
  );
};

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-slate-800 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function roleLabel(role) {
  if (role === 'doctor') return "Doctor";
  if (role === 'staff') return "Staff";
  return "Patient";
}


const inputClass =
  'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

export default LoginPage;
