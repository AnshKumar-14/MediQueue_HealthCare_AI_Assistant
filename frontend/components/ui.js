"use client";

import { Loader2, X } from "lucide-react";

const TONES = {
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-rose-50 text-rose-700 border-rose-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
};

const BUTTON_VARIANTS = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 border-blue-600",
  secondary:
    "bg-white text-slate-700 hover:bg-slate-50 border-slate-200",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 border-transparent",
  danger: "bg-rose-600 text-white hover:bg-rose-700 border-rose-600",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600",
};

const BUTTON_SIZES = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2.5 text-sm gap-2",
  lg: "px-5 py-3 text-sm gap-2",
};

export function Card({ className = "", children }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className = "" }) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3 ${className}`}
    >
      <div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {subtitle ? (
          <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-xl border font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function Badge({ tone = "slate", className = "", children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONES[tone] || TONES.slate} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = "blue" }) {
  const iconTone = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-rose-50 text-rose-600",
    violet: "bg-violet-50 text-violet-600",
  }[tone];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">{value}</p>
          {hint ? <p className="text-xs text-slate-500 mt-1">{hint}</p> : null}
        </div>
        {Icon ? (
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconTone}`}
          >
            <Icon className="w-5 h-5" />
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function EmptyState({ title, description, icon: Icon, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-12">
      {Icon ? (
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
          <Icon className="w-6 h-6" />
        </div>
      ) : null}
      <p className="font-semibold text-slate-800">{title}</p>
      {description ? (
        <p className="text-sm text-slate-500 mt-1 max-w-md">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Spinner({ label = "Loading..." }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
      <Loader2 className="w-4 h-4 animate-spin" />
      {label}
    </div>
  );
}

export function PageLoader({ label = "Loading..." }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex items-center gap-3 text-slate-600">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, children, footer, wide = false }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div
        className={`relative w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {subtitle ? (
              <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer ? (
          <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap justify-end gap-2">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Tabs({ tabs, active, onChange, className = "" }) {
  return (
    <div className={`flex gap-1.5 overflow-x-auto ${className}`}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
              isActive
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {Icon ? <Icon className="w-4 h-4" /> : null}
            {tab.label}
            {tab.count ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  isActive ? "bg-white/20" : "bg-slate-200 text-slate-700"
                }`}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-slate-800 mb-1.5">
        {label}
      </span>
      {children}
      {hint ? <span className="block text-xs text-slate-500 mt-1">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:text-slate-400";

export function AlertBanner({ type = "info", children, onClose }) {
  const tone =
    type === "error"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : type === "success"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-blue-50 text-blue-700 border-blue-200";

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${tone}`}
    >
      <span className="font-medium">{children}</span>
      {onClose ? (
        <button onClick={onClose} className="opacity-70 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      ) : null}
    </div>
  );
}

const PRIORITY_LABELS = {
  emergency: { label: "Emergency", tone: "red" },
  pregnant: { label: "Pregnant", tone: "violet" },
  senior: { label: "Senior", tone: "amber" },
  normal: { label: "Normal", tone: "slate" },
};

export function PriorityBadge({ priority }) {
  const meta = PRIORITY_LABELS[priority] || PRIORITY_LABELS.normal;
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

const STATUS_LABELS = {
  booked: { label: "Booked", tone: "blue" },
  "checked-in": { label: "Checked in", tone: "amber" },
  "in-queue": { label: "In queue", tone: "blue" },
  waiting: { label: "Waiting", tone: "amber" },
  called: { label: "Called", tone: "green" },
  "in-progress": { label: "In consultation", tone: "green" },
  completed: { label: "Completed", tone: "green" },
  cancelled: { label: "Cancelled", tone: "red" },
  "no-show": { label: "No-show", tone: "red" },
  skipped: { label: "Skipped", tone: "slate" },
  pending: { label: "Pending", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
  active: { label: "Active", tone: "green" },
  inactive: { label: "Inactive", tone: "slate" },
};

export function StatusBadge({ status }) {
  const meta = STATUS_LABELS[status] || { label: status || "Unknown", tone: "slate" };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
