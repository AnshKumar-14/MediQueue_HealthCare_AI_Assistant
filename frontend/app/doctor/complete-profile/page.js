"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import React from 'react'
import { apiRequest } from "@/lib/api";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const CompleteDoctorProfile = () => {

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    qualification: "",
    experience: "",
    hospitalName: "",
    clinicAddress: "",
    consultationFee: "",
    bio: "",
    dailyPatientCapacity: "",
  })
  const [availability, setAvailability] = useState(
    DAYS.map((day) => ({
      day,
      available: false,
      startTime: "",
      endTime: "",
    }))
  );

  useEffect(() => {
    const checkProfile = async () => {
      try {
        const data = await apiRequest("/api/doctor/profile");

        if (data.profileCompleted) {
          router.replace("/doctor/dashboard");
          return;
        }

        setLoading(false);
      } catch (error) {
        if (error.status === 401) {
          router.replace("/login");
          return;
        }
        setError(error.message || "Unable to load your profile");
        setLoading(false);
      }
    };

    checkProfile();

  }, [router]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAvailabilityChange = (index) => {
    setAvailability((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              available: !item.available,
            }
          : item
      )
    );
  };

  const handleTimeChange = (index, field, value) => {
    setAvailability((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");

    // Get only available days
    const selectedAvailability = availability
      .filter((item) => item.available)
      .map((item) => ({
        day: item.day,
        startTime: item.startTime,
        endTime: item.endTime,
      }));

    if (selectedAvailability.length === 0) {
      setError("Please select at least one available day.");
      return;
    }

    for (const item of selectedAvailability) {
      if (!item.startTime || !item.endTime) {
        setError(`Please select start and end time for ${item.day}.`);
        return;
      }

      if (item.startTime >= item.endTime) {
        setError(
          `End time must be later than start time for ${item.day}.`
        );
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        qualification: formData.qualification,
        experience: Number(formData.experience),
        hospitalName: formData.hospitalName,
        clinicAddress: formData.clinicAddress,
        consultationFee: Number(formData.consultationFee),
        bio: formData.bio,
        dailyPatientCapacity: Number(
          formData.dailyPatientCapacity
        ),
        availability: selectedAvailability,
      }

      await apiRequest("/api/doctor/profile", {
        method: "POST",
        body: payload,
      });

      router.replace("/doctor/dashboard");
    } catch (error) {
      if (error.status === 401) {
        router.replace("/login");
        return;
      }
      setError(error.message || "Unable to connect to server");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Checking your profile...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="w-full max-w-3xl mx-auto bg-white rounded-3xl shadow-xl p-6 sm:p-10">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-slate-900">
            Complete Your Doctor Profile
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            This information is shown to patients before they book an appointment.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Qualification">
              <input
                type="text"
                name="qualification"
                placeholder="e.g. MBBS, MD"
                value={formData.qualification}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </Field>

            <Field label="Experience (years)">
              <input
                type="number"
                name="experience"
                min="0"
                placeholder="e.g. 5"
                value={formData.experience}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </Field>

            <Field label="Hospital Name">
              <input
                type="text"
                name="hospitalName"
                placeholder="e.g. City Care Hospital"
                value={formData.hospitalName}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </Field>

            <Field label="Clinic Address">
              <input
                type="text"
                name="clinicAddress"
                placeholder="Full clinic address"
                value={formData.clinicAddress}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </Field>

            <Field label="Consultation Fee (₹)">
              <input
                type="number"
                name="consultationFee"
                min="0"
                placeholder="e.g. 500"
                value={formData.consultationFee}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </Field>

            <Field label="Daily Patient Capacity">
              <input
                type="number"
                name="dailyPatientCapacity"
                min="1"
                placeholder="e.g. 20"
                value={formData.dailyPatientCapacity}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Bio">
            <textarea
              name="bio"
              rows={4}
              placeholder="Tell patients about your expertise and approach to care."
              value={formData.bio}
              onChange={handleChange}
              required
              className={`${inputClass} resize-none`}
            />
          </Field>

          <div>
            <p className="block text-sm font-semibold text-slate-800 mb-2">
              Weekly Availability
            </p>
            <div className="space-y-2">
              {availability.map((item, index) => (
                <div
                  key={item.day}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-slate-200 p-3"
                >
                  <label className="flex items-center gap-2 sm:w-40 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={item.available}
                      onChange={() => handleAvailabilityChange(index)}
                      className="h-4 w-4 accent-blue-600"
                    />
                    {item.day}
                  </label>

                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={item.startTime}
                      disabled={!item.available}
                      onChange={(e) =>
                        handleTimeChange(index, "startTime", e.target.value)
                      }
                      className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-400`}
                    />
                    <span className="text-sm text-slate-400">to</span>
                    <input
                      type="time"
                      value={item.endTime}
                      disabled={!item.available}
                      onChange={(e) =>
                        handleTimeChange(index, "endTime", e.target.value)
                      }
                      className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-400`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-xl py-3 transition-colors"
          >
            {submitting ? "Saving profile..." : "Save Profile"}
          </button>
        </form>
      </div>
    </main>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-slate-800 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

export default CompleteDoctorProfile;
