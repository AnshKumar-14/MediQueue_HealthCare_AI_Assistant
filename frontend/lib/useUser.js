"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "./api";

/**
 * Loads the current session user. `allowedRoles` is serialized to a string so
 * that passing an inline array does not re-trigger the effect on every render.
 */
export function useUser({ redirect = true, allowedRoles } = {}) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const roleKey = (allowedRoles || []).join(",");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest("/api/auth/me");
      const currentUser = data.user;
      const allowed = roleKey ? roleKey.split(",") : null;

      if (allowed && !allowed.includes(currentUser.role)) {
        router.replace("/login");
        return;
      }

      setUser(currentUser);
      setError("");
    } catch (err) {
      if (err.status === 401 && redirect) {
        router.replace("/login");
        return;
      }
      setError(err.message || "Failed to load your session");
    } finally {
      setLoading(false);
    }
  }, [redirect, roleKey, router]);

  useEffect(() => {
    load();
  }, [load]);

  return { user, setUser, loading, error, refresh: load };
}

export function roleLabel(role) {
  switch (role) {
    case "doctor":
      return "Doctor";
    case "receptionist":
      return "Receptionist";
    case "staff":
      return "Staff";
    case "admin":
      return "Administrator";
    default:
      return "Patient";
  }
}

export function dashboardPathFor(role) {
  switch (role) {
    case "doctor":
      return "/doctor/dashboard";
    case "admin":
      return "/admin/dashboard";
    case "receptionist":
    case "staff":
      return "/staff/dashboard";
    default:
      return "/patient/dashboard";
  }
}
