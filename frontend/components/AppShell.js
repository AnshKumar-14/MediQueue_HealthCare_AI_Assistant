"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, MonitorPlay, Stethoscope } from "lucide-react";
import { apiRequest } from "@/lib/api";
import NotificationBell from "./NotificationBell";
import { Tabs } from "./ui";

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function AppShell({
  user,
  roleLabel,
  title,
  subtitle,
  tabs = [],
  activeTab,
  onTabChange,
  actions,
  children,
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch {
      // Even if the request fails, clear the local session view.
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col bg-white border-r border-slate-200">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
            <Stethoscope className="w-5 h-5" />
          </div>
          <span className="text-lg font-extrabold text-slate-900">
            Medi<span className="text-blue-600">Queue</span>
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <p className="px-3 pt-2 pb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            {roleLabel} workspace
          </p>
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.key === activeTab;
              return (
                <button
                  key={tab.key}
                  onClick={() => onTabChange?.(tab.key)}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {Icon ? <Icon className="w-4 h-4 shrink-0" /> : null}
                  <span className="flex-1 text-left">{tab.label}</span>
                  {tab.count ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {tab.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <Link
              href="/display"
              target="_blank"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              <MonitorPlay className="w-4 h-4" />
              Waiting room display
            </Link>
          </div>
        </div>

        <div className="p-3 border-t border-slate-200">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
              {initials(user?.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {user?.name || "Loading..."}
              </p>
              <p className="text-xs text-slate-500 truncate">{roleLabel}</p>
            </div>
            <button
              onClick={logout}
              disabled={loggingOut}
              title="Log out"
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-rose-600 disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 h-16 bg-white/90 backdrop-blur border-b border-slate-200">
          <div className="h-full px-4 md:px-8 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 md:hidden">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                <Stethoscope className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-slate-900">
                Medi<span className="text-blue-600">Queue</span>
              </span>
            </div>

            <div className="hidden md:block min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{title}</p>
              {subtitle ? (
                <p className="text-xs text-slate-500 truncate">{subtitle}</p>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {actions}
              <NotificationBell />
              <div className="hidden sm:flex items-center gap-2 pl-2">
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                  {initials(user?.name)}
                </div>
                <button
                  onClick={logout}
                  disabled={loggingOut}
                  title="Log out"
                  className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-rose-600 disabled:opacity-50 md:hidden"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="md:hidden border-b border-slate-200 bg-white px-3 py-2 overflow-x-auto">
          <Tabs
            tabs={tabs}
            active={activeTab}
            onChange={(key) => onTabChange?.(key)}
          />
        </div>

        <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
            {subtitle ? (
              <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
            ) : null}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
