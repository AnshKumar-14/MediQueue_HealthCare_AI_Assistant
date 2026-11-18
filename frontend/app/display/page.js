"use client";

import { useEffect, useState } from "react";
import { Clock, Maximize, Stethoscope, Users } from "lucide-react";
import { formatDateLabel } from "@/lib/api";
import { useDisplayQueue } from "@/lib/useQueue";

function firstName(name = "") {
  return name.split(" ").filter(Boolean)[0] || "";
}

export default function DisplayPage() {
  const { display, loading, error } = useDisplayQueue();
  const [now, setNow] = useState(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  function goFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      document.documentElement.requestFullscreen?.();
    }
  }

  const doctors = display?.doctors || [];
  const totalWaiting = doctors.reduce(
    (sum, doctor) => sum + (doctor.remaining || 0),
    0
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -left-40 w-[32rem] h-[32rem] rounded-full bg-blue-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 w-[32rem] h-[32rem] rounded-full bg-indigo-500/20 blur-3xl" />

      <header className="relative z-10 flex flex-wrap items-center justify-between gap-4 px-6 md:px-10 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xl font-extrabold leading-tight">
              Medi<span className="text-blue-400">Queue</span>
            </p>
            <p className="text-xs text-slate-400">Waiting room display</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-2xl font-extrabold tabular-nums">
              {now
                ? now.toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "--:--:--"}
            </p>
            <p className="text-xs text-slate-400">
              {now ? formatDateLabel(now.toISOString().slice(0, 10)) : ""}
            </p>
          </div>
          <button
            onClick={goFullscreen}
            className="w-10 h-10 rounded-xl border border-white/15 bg-white/5 flex items-center justify-center text-slate-300 hover:bg-white/10"
            title="Toggle fullscreen"
          >
            <Maximize className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="relative z-10 px-6 md:px-10 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold">
              Now serving
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Please watch this screen for your token number.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
            <Users className="w-4 h-4 text-blue-400" />
            {totalWaiting} patient{totalWaiting === 1 ? "" : "s"} waiting
          </div>
        </div>

        {loading && !display ? (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <Clock className="w-5 h-5 animate-spin mr-2" />
            Loading live queue...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-rose-200">
            {error}
          </div>
        ) : doctors.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-20 text-center">
            <p className="text-3xl font-extrabold text-slate-200">
              No active queue
            </p>
            <p className="text-sm text-slate-400 mt-2">
              Tokens will appear here as soon as patients check in.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {doctors.map((doctor) => (
              <div
                key={doctor.doctor?._id || doctor.doctor?.name}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 flex flex-col"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-white">
                      {doctor.doctor?.name || "Doctor"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {doctor.department?.name || "General"}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-300 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                </div>

                <div className="mt-5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 px-5 py-6 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-100">
                    Token
                  </p>
                  <p className="text-6xl font-black leading-none mt-1">
                    {doctor.current ? `#${doctor.current.tokenNumber}` : "—"}
                  </p>
                  <p className="text-sm text-blue-100 mt-2 min-h-5">
                    {doctor.current
                      ? `${firstName(doctor.current.patientName)}${
                          doctor.current.status === "in-progress"
                            ? " · in consultation"
                            : " · please proceed"
                        }`
                      : "Waiting for the next patient"}
                  </p>
                </div>

                <div className="mt-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                    Up next
                  </p>
                  {doctor.waiting.length === 0 ? (
                    <p className="text-sm text-slate-500">Queue is clear</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {doctor.waiting.slice(0, 6).map((entry) => (
                        <span
                          key={`${doctor.doctor?._id}-${entry.tokenNumber}`}
                          className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-bold text-slate-200"
                        >
                          #{entry.tokenNumber}
                          {entry.priority && entry.priority !== "normal" ? (
                            <span className="ml-1.5 text-[10px] font-bold uppercase text-amber-300">
                              {entry.priority}
                            </span>
                          ) : null}
                        </span>
                      ))}
                      {doctor.waiting.length > 6 ? (
                        <span className="text-sm text-slate-400">
                          +{doctor.waiting.length - 6} more
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>

                <p className="mt-auto pt-4 text-xs text-slate-500">
                  {doctor.remaining} waiting ·{" "}
                  {doctor.current ? "Now serving" : "Available"}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="relative z-10 px-6 md:px-10 py-4 border-t border-white/10 text-center">
        <p className="text-sm text-slate-400">
          Emergency, senior and pregnant patients may be prioritised. Please keep
          your token and phone nearby.
        </p>
      </footer>
    </div>
  );
}
