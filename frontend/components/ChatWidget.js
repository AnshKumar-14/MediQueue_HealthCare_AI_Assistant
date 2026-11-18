"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Headset,
  Languages,
  Loader2,
  MessageCircle,
  Mic,
  MicOff,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { API_URL } from "@/lib/api";

const STORAGE_KEY = "mediqueue.chat.conversation";
const TTS_KEY = "mediqueue.chat.tts";

const SPEECH_LANGS = {
  en: "en-IN",
  hi: "hi-IN",
  es: "es-ES",
  fr: "fr-FR",
  ar: "ar-SA",
};

const FALLBACK_LOCALES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "ar", label: "العربية" },
];

const REMINDER_STATUS = {
  pending: "Scheduled",
  sent: "Sent",
  acknowledged: "Taken",
  cancelled: "Cancelled",
};

const REMINDER_STATUS_STYLES = {
  pending: "bg-blue-50 text-blue-700",
  sent: "bg-amber-50 text-amber-700",
  acknowledged: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-500",
};

const CONTACT_METHODS = [
  { value: "in-app", label: "In-app" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
];

function formatReminderTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    if (value === null || value === undefined) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Storage can be blocked in private mode; chat still works.
  }
}

function plainText(value = "") {
  return String(value)
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function mergeConversation(current, next) {
  return next ? { ...(current || {}), ...next } : current;
}

async function parseJson(response) {
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const failure = new Error(
      data?.message || `Chat request failed (${response.status})`
    );
    failure.status = response.status;
    failure.code = data?.code;
    throw failure;
  }
  return data;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [booting, setBooting] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [locales, setLocales] = useState(FALLBACK_LOCALES);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [listening, setListening] = useState(false);
  const [ttsOn, setTtsOn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState({});
  const [panel, setPanel] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [reminderForm, setReminderForm] = useState({
    type: "medication",
    title: "",
    message: "",
    scheduledFor: "",
  });
  const [preferences, setPreferences] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [panelBusy, setPanelBusy] = useState(false);

  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);
  const ttsRef = useRef(false);
  const startedRef = useRef(false);

  const locale = conversation?.locale || "en";
  const isRtl = locale === "ar";
  const consentGiven = conversation?.consent?.given !== false;
  const handoffActive = ["handoff-requested", "handoff-active"].includes(
    conversation?.status
  );
  const assistantName =
    conversation?.user?.name?.split(" ")[0] || null;
  const isPatient = conversation?.user?.role === "patient";

  useEffect(() => {
    setTtsOn(readStorage(TTS_KEY) === "on");
  }, []);

  useEffect(() => {
    ttsRef.current = ttsOn;
  }, [ttsOn]);

  const speak = useCallback((text) => {
    if (!ttsRef.current || !text || typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(plainText(text).slice(0, 700));
      utterance.lang = SPEECH_LANGS[locale] || "en-IN";
      utterance.rate = 0.98;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Voice output is a bonus; ignore failures.
    }
  }, [locale]);

  const applyPayload = useCallback((payload, tempUserId) => {
    setMessages((previous) => {
      let next = previous;
      if (payload.userMessage) {
        next = next.map((message) =>
          message._id === tempUserId ? payload.userMessage : message
        );
      }
      if (payload.assistantMessage) {
        const exists = next.some(
          (message) => message._id === payload.assistantMessage._id
        );
        next = exists ? next : [...next, payload.assistantMessage];
      } else if (payload.reply) {
        next = [
          ...next,
          {
            _id: `local-${Date.now()}`,
            role: "assistant",
            content: payload.reply,
            suggestions: payload.suggestions || [],
            createdAt: new Date().toISOString(),
          },
        ];
      }
      return next;
    });
    if (payload.suggestions) setSuggestions(payload.suggestions);
    if (payload.conversation) {
      setConversation((current) => mergeConversation(current, payload.conversation));
    }
    if (payload.reply) speak(payload.reply);
  }, [speak]);

  const loadReminders = useCallback(async () => {
    setPanelBusy(true);
    try {
      const response = await fetch(`${API_URL}/api/chat/reminders`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await parseJson(response);
      setReminders(Array.isArray(data.reminders) ? data.reminders : []);
    } catch (failure) {
      setError(failure.message || "Could not load your reminders.");
    } finally {
      setPanelBusy(false);
    }
  }, []);

  const loadPreferences = useCallback(async () => {
    setPanelBusy(true);
    try {
      const [preferenceResponse, doctorResponse] = await Promise.all([
        fetch(`${API_URL}/api/chat/preferences`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`${API_URL}/api/doctors`, {
          credentials: "include",
          cache: "no-store",
        }).catch(() => null),
      ]);
      const preferenceData = await parseJson(preferenceResponse);
      const next = preferenceData.preferences || {};
      setPreferences(next);
      if (typeof next.voiceReplies === "boolean") {
        setTtsOn(next.voiceReplies);
        writeStorage(TTS_KEY, next.voiceReplies ? "on" : "off");
      }
      if (doctorResponse?.ok) {
        const doctorData = await doctorResponse.json().catch(() => null);
        setDoctors(Array.isArray(doctorData?.doctors) ? doctorData.doctors : []);
      }
    } catch (failure) {
      setError(failure.message || "Could not load your preferences.");
    } finally {
      setPanelBusy(false);
    }
  }, []);

  const persistPreferences = useCallback(
    async (patch) => {
      if (!isPatient) return null;
      try {
        const response = await fetch(`${API_URL}/api/chat/preferences`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = await parseJson(response);
        setPreferences(data.preferences || null);
        return data.preferences || null;
      } catch (failure) {
        setError(failure.message || "Could not save your preferences.");
        return null;
      }
    },
    [isPatient]
  );

  const savePreferences = useCallback(async () => {
    if (!preferences) return;
    setPanelBusy(true);
    const saved = await persistPreferences({
      language: preferences.language || locale,
      contactMethod: preferences.contactMethod || "in-app",
      preferredDoctor:
        preferences.preferredDoctor?._id || preferences.preferredDoctor || "",
      medicationReminders: Boolean(preferences.medicationReminders),
      followUpReminders: Boolean(preferences.followUpReminders),
      voiceReplies: Boolean(preferences.voiceReplies),
    });
    setPanelBusy(false);
    if (saved) {
      setError("");
      setNotice("Preferences saved.");
    }
  }, [locale, persistPreferences, preferences]);

  const submitReminder = useCallback(async () => {
    if (
      !reminderForm.title.trim() ||
      !reminderForm.message.trim() ||
      !reminderForm.scheduledFor
    ) {
      setError("Add a title, details and time for the reminder.");
      return;
    }
    setPanelBusy(true);
    try {
      const response = await fetch(`${API_URL}/api/chat/reminders`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: reminderForm.type,
          title: reminderForm.title.trim(),
          message: reminderForm.message.trim(),
          scheduledFor: new Date(reminderForm.scheduledFor).toISOString(),
        }),
      });
      const data = await parseJson(response);
      if (data.reminder) {
        setReminders((current) =>
          [...current, data.reminder].sort(
            (a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor)
          )
        );
      }
      setReminderForm({
        type: "medication",
        title: "",
        message: "",
        scheduledFor: "",
      });
      setError("");
      setNotice("Reminder scheduled.");
    } catch (failure) {
      setError(failure.message || "Could not create the reminder.");
    } finally {
      setPanelBusy(false);
    }
  }, [reminderForm]);

  const cancelReminder = useCallback(async (reminderId) => {
    setPanelBusy(true);
    try {
      const response = await fetch(
        `${API_URL}/api/chat/reminders/${reminderId}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = await parseJson(response);
      setReminders((current) =>
        current.map((reminder) =>
          reminder._id === reminderId
            ? { ...reminder, ...(data.reminder || {}), status: "cancelled" }
            : reminder
        )
      );
      setNotice("Reminder cancelled.");
    } catch (failure) {
      setError(failure.message || "Could not cancel the reminder.");
    } finally {
      setPanelBusy(false);
    }
  }, []);

  const acknowledgeReminder = useCallback(async (reminderId) => {
    setPanelBusy(true);
    try {
      const response = await fetch(
        `${API_URL}/api/chat/reminders/${reminderId}/ack`,
        { method: "POST", credentials: "include" }
      );
      const data = await parseJson(response);
      setReminders((current) =>
        current.map((reminder) =>
          reminder._id === reminderId
            ? {
                ...reminder,
                ...(data.reminder || {}),
                status: "acknowledged",
              }
            : reminder
        )
      );
      setNotice("Marked as taken.");
    } catch (failure) {
      setError(failure.message || "Could not update the reminder.");
    } finally {
      setPanelBusy(false);
    }
  }, []);

  const startSession = useCallback(async (conversationId) => {
    setBooting(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/chat/session`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(conversationId ? { conversationId } : {}),
      });

      if (response.status === 403 || response.status === 404) {
        writeStorage(STORAGE_KEY, null);
        if (conversationId) {
          await startSession(null);
          return;
        }
      }

      const data = await parseJson(response);
      setConversation(data.conversation || null);
      setMessages(data.messages || []);
      setSuggestions(data.suggestions || []);
      if (Array.isArray(data.locales) && data.locales.length) {
        setLocales(data.locales);
      }
      if (data.conversation?.id) {
        writeStorage(STORAGE_KEY, data.conversation.id);
      }
    } catch (failure) {
      setError(
        failure.status === 429
          ? failure.message
          : "I couldn't connect to the assistant. Please check that the MediQueue API is running and try again."
      );
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    if (!open || startedRef.current) return;
    startedRef.current = true;
    const saved = readStorage(STORAGE_KEY);
    startSession(saved || null);
  }, [open, startSession]);

  useEffect(() => {
    if (!open) return;
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, sending, open, error]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop?.();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (!open || !panel) return;
    if (panel === "reminders") {
      loadReminders();
    } else if (panel === "preferences") {
      loadPreferences();
    }
  }, [open, panel, loadReminders, loadPreferences]);

  useEffect(() => {
    if (!open || !conversation?.id || !handoffActive || sending) return;

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/chat/${conversation.id}`,
          { credentials: "include", cache: "no-store" }
        );
        if (!response.ok) return;
        const data = await response.json();
        if (Array.isArray(data.messages)) setMessages(data.messages);
        if (data.conversation) {
          setConversation((current) =>
            mergeConversation(current, data.conversation)
          );
        }
      } catch {
        // Polling is best effort; the next tick will retry.
      }
    }, 8000);

    return () => window.clearInterval(timer);
  }, [open, conversation?.id, handoffActive, sending]);

  const send = useCallback(
    async (rawText) => {
      const text = String(rawText || "").trim();
      if (!text || sending || !conversation?.id || !consentGiven) return;

      const tempUserId = `local-user-${Date.now()}`;
      setMessages((previous) => [
        ...previous,
        {
          _id: tempUserId,
          role: "user",
          content: text,
          createdAt: new Date().toISOString(),
        },
      ]);
      setInput("");
      setSuggestions([]);
      setSending(true);
      setError("");

      try {
        const response = await fetch(
          `${API_URL}/api/chat/${conversation.id}/stream`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              Accept: "text/event-stream",
            },
            body: JSON.stringify({ text }),
          }
        );

        if (!response.ok) {
          const data = await parseJson(response);
          applyPayload(data, tempUserId);
          return;
        }

        const contentType = response.headers.get("content-type") || "";
        if (!response.body || !contentType.includes("text/event-stream")) {
          const data = await parseJson(response);
          applyPayload(data, tempUserId);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const assistantId = `local-assistant-${Date.now()}`;
        let assistantStarted = false;
        let finalPayload = null;

        const handleEvent = (payload) => {
          if (!payload) return;
          if (payload.type === "user" && payload.message) {
            setMessages((previous) =>
              previous.map((message) =>
                message._id === tempUserId ? payload.message : message
              )
            );
            return;
          }
          if (payload.type === "chunk") {
            const delta = payload.delta || "";
            if (!assistantStarted) {
              assistantStarted = true;
              setMessages((previous) => [
                ...previous,
                {
                  _id: assistantId,
                  role: "assistant",
                  content: delta,
                  suggestions: [],
                  createdAt: new Date().toISOString(),
                },
              ]);
            } else {
              setMessages((previous) =>
                previous.map((message) =>
                  message._id === assistantId
                    ? { ...message, content: `${message.content}${delta}` }
                    : message
                )
              );
            }
            return;
          }
          if (payload.type === "done") {
            finalPayload = payload;
            if (payload.assistantMessage) {
              setMessages((previous) => {
                const withoutDraft = previous.filter(
                  (message) => message._id !== assistantId
                );
                return [...withoutDraft, payload.assistantMessage];
              });
            }
            setSuggestions(payload.suggestions || []);
            setConversation((current) =>
              mergeConversation(current, payload.conversation)
            );
            if (payload.reply) speak(payload.reply);
            return;
          }
          if (payload.type === "error") {
            throw new Error(payload.message || "The assistant could not reply.");
          }
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let boundary = buffer.indexOf("\n\n");
          while (boundary !== -1) {
            const frame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const dataLine = frame
              .split("\n")
              .find((line) => line.startsWith("data:"));
            if (dataLine) {
              try {
                handleEvent(JSON.parse(dataLine.slice(5).trim()));
              } catch (parseError) {
                if (parseError instanceof SyntaxError) {
                  // Ignore a malformed frame; the final payload still arrives.
                } else {
                  throw parseError;
                }
              }
            }
            boundary = buffer.indexOf("\n\n");
          }
        }

        if (!finalPayload && !assistantStarted) {
          throw new Error("The assistant did not return a reply.");
        }
      } catch (failure) {
        setMessages((previous) =>
          previous.map((message) =>
            message._id === tempUserId
              ? { ...message, failed: true }
              : message
          )
        );
        setError(
          failure.status === 429
            ? failure.message
            : failure.message || "Something went wrong. Please try again."
        );
      } finally {
        setSending(false);
      }
    },
    [applyPayload, consentGiven, conversation?.id, sending, speak]
  );

  const submitFeedback = useCallback(
    async (messageId, rating) => {
      if (!conversation?.id || !messageId || messageId.startsWith("local-")) return;
      setFeedback((current) => ({ ...current, [messageId]: rating }));
      try {
        await fetch(`${API_URL}/api/chat/${conversation.id}/feedback`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId, rating }),
        });
        setNotice(
          rating === "up"
            ? "Thanks — that helps us improve."
            : "Thanks for the feedback. You can also ask for a person."
        );
      } catch {
        setFeedback((current) => ({ ...current, [messageId]: "" }));
      }
    },
    [conversation?.id]
  );

  const requestHandoff = useCallback(async () => {
    if (!conversation?.id || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(
        `${API_URL}/api/chat/${conversation.id}/handoff`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Patient asked for a human team member" }),
        }
      );
      const data = await parseJson(response);
      setConversation((current) => mergeConversation(current, data.conversation));
      if (data.assistantMessage) {
        setMessages((previous) => [...previous, data.assistantMessage]);
      }
      setSuggestions([]);
      speak(data.reply);
    } catch (failure) {
      setError(failure.message || "Could not reach the reception team.");
    } finally {
      setSending(false);
    }
  }, [conversation?.id, sending, speak]);

  const changeLanguage = useCallback(
    async (nextLocale) => {
      if (!conversation?.id || !nextLocale || nextLocale === locale) return;
      setError("");
      try {
        const response = await fetch(
          `${API_URL}/api/chat/${conversation.id}/language`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ locale: nextLocale }),
          }
        );
        const data = await parseJson(response);
        setConversation((current) => mergeConversation(current, data.conversation));
        if (data.assistantMessage) {
          setMessages((previous) => [...previous, data.assistantMessage]);
        }
        if (data.suggestions) setSuggestions(data.suggestions);
        speak(data.reply);
      } catch (failure) {
        setError(failure.message || "Could not change the language.");
      }
    },
    [conversation?.id, locale, speak]
  );

  const giveConsent = useCallback(async () => {
    if (!conversation?.id) return;
    try {
      const response = await fetch(
        `${API_URL}/api/chat/${conversation.id}/consent`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: "2026-01" }),
        }
      );
      const data = await parseJson(response);
      setConversation((current) => mergeConversation(current, data.conversation));
      window.setTimeout(() => textareaRef.current?.focus(), 100);
    } catch (failure) {
      setError(failure.message || "Could not save your consent.");
    }
  }, [conversation?.id]);

  const resetChat = useCallback(
    async (remove = false) => {
      setMenuOpen(false);
      if (!conversation?.id) {
        startedRef.current = true;
        await startSession(null);
        return;
      }
      try {
        if (remove) {
          await fetch(`${API_URL}/api/chat/${conversation.id}`, {
            method: "DELETE",
            credentials: "include",
          });
        }
        writeStorage(STORAGE_KEY, null);
        setConversation(null);
        setMessages([]);
        setSuggestions([]);
        setFeedback({});
        setPanel(null);
        setNotice("");
        setError("");
        await startSession(null);
      } catch {
        setError("Could not start a new chat. Please try again.");
      }
    },
    [conversation?.id, startSession]
  );

  const toggleTts = useCallback(() => {
    const next = !ttsOn;
    setTtsOn(next);
    writeStorage(TTS_KEY, next ? "on" : "off");
    if (!next && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (isPatient) {
      persistPreferences({ voiceReplies: next });
    }
  }, [isPatient, persistPreferences, ttsOn]);

  const startVoice = useCallback(() => {
    if (typeof window === "undefined") return;
    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError(
        "Voice input isn't available in this browser. You can type your message instead."
      );
      return;
    }
    try {
      recognitionRef.current?.stop?.();
      const recognition = new Recognition();
      recognition.lang = SPEECH_LANGS[locale] || "en-IN";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript || "";
        if (transcript) {
          setInput((previous) =>
            previous ? `${previous} ${transcript}`.trim() : transcript
          );
        }
      };
      recognition.onerror = (event) => {
        if (event.error !== "aborted" && event.error !== "no-speech") {
          setError("I couldn't hear that. Please try again or type your message.");
        }
        setListening(false);
      };
      recognition.onend = () => setListening(false);
      recognitionRef.current = recognition;
      setError("");
      setListening(true);
      recognition.start();
    } catch {
      setListening(false);
      setError("Voice input could not start. Please type your message.");
    }
  }, [locale]);

  const stopVoice = useCallback(() => {
    recognitionRef.current?.stop?.();
    setListening(false);
  }, []);

  const onKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send(input);
    }
  };

  const lastAssistantIndex = (() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role !== "user") return index;
    }
    return -1;
  })();

  const panelView =
    panel === "reminders" ? (
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-slate-900">Reminders</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
              Medication and follow-up nudges. Messages are encrypted and kept
              only for 30 days.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPanel(null)}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Chat
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <Plus className="h-3.5 w-3.5" /> New reminder
          </p>
          <div className="mt-2 space-y-2">
            <select
              value={reminderForm.type}
              onChange={(event) =>
                setReminderForm((current) => ({
                  ...current,
                  type: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="medication">Medication</option>
              <option value="follow-up">Follow-up</option>
              <option value="appointment">Appointment</option>
            </select>
            <input
              value={reminderForm.title}
              onChange={(event) =>
                setReminderForm((current) => ({
                  ...current,
                  title: event.target.value.slice(0, 200),
                }))
              }
              placeholder="Title (e.g. Blood pressure tablet)"
              className="w-full rounded-xl border border-slate-200 px-2.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={reminderForm.message}
              onChange={(event) =>
                setReminderForm((current) => ({
                  ...current,
                  message: event.target.value.slice(0, 1000),
                }))
              }
              placeholder="Details (e.g. 1 tablet after breakfast)"
              className="w-full rounded-xl border border-slate-200 px-2.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="datetime-local"
              value={reminderForm.scheduledFor}
              onChange={(event) =>
                setReminderForm((current) => ({
                  ...current,
                  scheduledFor: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-200 px-2.5 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={submitReminder}
              disabled={panelBusy}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {panelBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Schedule reminder
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {panelBusy && reminders.length === 0 ? (
            <p className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading reminders...
            </p>
          ) : null}
          {!panelBusy && reminders.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-5 text-center text-[11px] leading-relaxed text-slate-500">
              No reminders yet. Add one above, or ask me in chat to remind you.
            </p>
          ) : null}
          {reminders.map((reminder) => {
            const active = ["pending", "sent"].includes(reminder.status);
            return (
              <div
                key={reminder._id}
                className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900">
                      {reminder.title}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                      <Clock className="h-3 w-3" />
                      {formatReminderTime(reminder.scheduledFor)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      REMINDER_STATUS_STYLES[reminder.status] ||
                      "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {REMINDER_STATUS[reminder.status] || reminder.status}
                  </span>
                </div>
                {reminder.message ? (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">
                    {reminder.message}
                  </p>
                ) : null}
                {active ? (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => acknowledgeReminder(reminder._id)}
                      disabled={panelBusy}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark taken
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelReminder(reminder._id)}
                      disabled={panelBusy}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> Cancel
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    ) : panel === "preferences" ? (
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-slate-900">Preferences</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
              Choose how we reach you and which reminders you want.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPanel(null)}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Chat
          </button>
        </div>

        {!preferences ? (
          <p className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading preferences...
          </p>
        ) : (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Contact method
              </span>
              <select
                value={preferences.contactMethod || "in-app"}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    contactMethod: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CONTACT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Preferred doctor
              </span>
              <select
                value={
                  preferences.preferredDoctor?._id ||
                  preferences.preferredDoctor ||
                  ""
                }
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    preferredDoctor: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No preference</option>
                {doctors.map((doctor) => (
                  <option key={doctor._id} value={doctor._id}>
                    {doctor.name}
                    {doctor.specialty ? ` — ${doctor.specialty}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center justify-between gap-3 text-xs font-medium text-slate-700">
              <span>Medication reminders</span>
              <input
                type="checkbox"
                checked={Boolean(preferences.medicationReminders)}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    medicationReminders: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-xs font-medium text-slate-700">
              <span>Follow-up reminders</span>
              <input
                type="checkbox"
                checked={Boolean(preferences.followUpReminders)}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    followUpReminders: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-xs font-medium text-slate-700">
              <span>Spoken replies</span>
              <input
                type="checkbox"
                checked={Boolean(preferences.voiceReplies)}
                onChange={(event) => {
                  const next = event.target.checked;
                  setPreferences((current) => ({
                    ...current,
                    voiceReplies: next,
                  }));
                  setTtsOn(next);
                  writeStorage(TTS_KEY, next ? "on" : "off");
                }}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
            </label>

            <p className="text-[11px] leading-relaxed text-slate-500">
              Language is set from the selector above the chat. Reminders use
              your contact method when an outbound channel is configured.
            </p>

            <button
              type="button"
              onClick={savePreferences}
              disabled={panelBusy}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {panelBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Save preferences
            </button>
          </div>
        )}
      </div>
    ) : null;

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open the MediQueue assistant"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-xl shadow-blue-900/20 transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="hidden sm:inline">Need help?</span>
        </button>
      ) : null}

      {open ? (
        <section
          role="dialog"
          aria-label="MediQueue assistant"
          className="fixed inset-x-3 bottom-3 z-40 flex h-[85vh] max-h-[660px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[400px]"
        >
          <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-br from-blue-600 to-blue-700 px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">
                  {assistantName ? `Hi ${assistantName}, I'm MediQueue` : "MediQueue Assistant"}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-blue-100">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      handoffActive ? "bg-amber-300" : "bg-emerald-300"
                    }`}
                  />
                  {handoffActive
                    ? "Reception team notified"
                    : "Usually replies instantly"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleTts}
                aria-label={ttsOn ? "Turn off spoken replies" : "Turn on spoken replies"}
                title={ttsOn ? "Turn off spoken replies" : "Turn on spoken replies"}
                className="rounded-lg p-1.5 text-blue-100 transition hover:bg-white/15 hover:text-white"
              >
                {ttsOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((value) => !value)}
                  aria-label="Chat options"
                  className="rounded-lg p-1.5 text-blue-100 transition hover:bg-white/15 hover:text-white"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                {menuOpen ? (
                  <div className="absolute right-0 top-9 z-10 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-slate-700 shadow-xl">
                    <button
                      type="button"
                      onClick={() => resetChat(false)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-slate-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Start a new chat
                    </button>
                    <button
                      type="button"
                      onClick={() => resetChat(true)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete this chat
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="rounded-lg p-1.5 text-blue-100 transition hover:bg-white/15 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <Languages className="h-3.5 w-3.5" />
              <span className="sr-only">Language</span>
              <select
                value={locale}
                onChange={(event) => changeLanguage(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {locales.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            {isPatient ? (
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() =>
                    setPanel((current) =>
                      current === "reminders" ? null : "reminders"
                    )
                  }
                  aria-pressed={panel === "reminders"}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                    panel === "reminders"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-blue-700"
                  }`}
                >
                  <Bell className="h-3.5 w-3.5" /> Reminders
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPanel((current) =>
                      current === "preferences" ? null : "preferences"
                    )
                  }
                  aria-pressed={panel === "preferences"}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                    panel === "preferences"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-blue-700"
                  }`}
                >
                  <Settings className="h-3.5 w-3.5" /> Preferences
                </button>
              </div>
            ) : null}
            <button
              type="button"
              onClick={requestHandoff}
              disabled={sending || handoffActive}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-white hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Headset className="h-3.5 w-3.5" />
              {handoffActive ? "Team notified" : "Talk to a person"}
            </button>
          </div>

          {panel ? (
            <div className="flex-1 overflow-y-auto bg-slate-50/70 px-3 py-4">
              {panelView}
            </div>
          ) : (
            <>
          <div
            ref={scrollRef}
            dir={isRtl ? "rtl" : "ltr"}
            className="flex-1 space-y-3 overflow-y-auto bg-slate-50/70 px-3 py-4"
          >
            {booting ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting you to the assistant...
              </div>
            ) : null}

            {!booting && conversation && !consentGiven ? (
              <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-bold text-slate-900">Before we start</p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  {conversation.consentPrompt ||
                    "I can help with appointments, queue status and clinic questions. Please don't share emergency information here. Your chat is encrypted and kept for 30 days."}
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  {conversation.disclaimer ||
                    "This assistant does not diagnose, prescribe or provide emergency care."}
                </p>
                <button
                  type="button"
                  onClick={giveConsent}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Check className="h-3.5 w-3.5" /> I understand and agree
                </button>
              </div>
            ) : null}

            {messages.map((message, index) => {
              const isUser = message.role === "user";
              const isStaff = message.role === "staff";
              const showSuggestions =
                !isUser &&
                index === lastAssistantIndex &&
                suggestions.length > 0 &&
                !sending;

              return (
                <div key={message._id || index} className="space-y-1.5">
                  <div
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                        isUser
                          ? "rounded-br-md bg-blue-600 text-white"
                          : isStaff
                            ? "rounded-bl-md border border-emerald-200 bg-emerald-50 text-emerald-900"
                            : "rounded-bl-md border border-slate-200 bg-white text-slate-800"
                      }`}
                    >
                      {isStaff ? (
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                          Reception team
                        </p>
                      ) : null}
                      {message.content}
                    </div>
                  </div>

                  {!isUser && !message.streaming ? (
                    <div className="flex items-center gap-1 pl-1">
                      <button
                        type="button"
                        aria-label="Helpful reply"
                        onClick={() => submitFeedback(message._id, "up")}
                        className={`rounded-md p-1 transition hover:bg-white ${
                          (feedback[message._id] || message.feedback) === "up"
                            ? "text-emerald-600"
                            : "text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Unhelpful reply"
                        onClick={() => submitFeedback(message._id, "down")}
                        className={`rounded-md p-1 transition hover:bg-white ${
                          (feedback[message._id] || message.feedback) === "down"
                            ? "text-rose-600"
                            : "text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}

                  {showSuggestions ? (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {suggestions.slice(0, 5).map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => send(suggestion)}
                          className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-50"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {sending ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2.5 text-slate-400 shadow-sm">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                </div>
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="flex items-start gap-2 border-t border-rose-100 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                aria-label="Dismiss error"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          {notice ? (
            <div className="flex items-center justify-between gap-2 border-t border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-medium text-emerald-700">
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice("")} aria-label="Dismiss notice">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          <div className="border-t border-slate-200 bg-white p-2.5">
            <div className="flex items-end gap-1.5">
              <button
                type="button"
                onClick={listening ? stopVoice : startVoice}
                disabled={!consentGiven || sending}
                aria-label={listening ? "Stop voice input" : "Start voice input"}
                className={`mb-0.5 rounded-xl p-2 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  listening
                    ? "bg-rose-100 text-rose-600"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                }`}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                disabled={!consentGiven || booting}
                onChange={(event) => setInput(event.target.value.slice(0, 1500))}
                onKeyDown={onKeyDown}
                placeholder={
                  consentGiven
                    ? "Ask about appointments, queue or the clinic..."
                    : "Please agree to continue"
                }
                className="max-h-24 min-h-[38px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
              />

              <button
                type="button"
                onClick={() => send(input)}
                disabled={!input.trim() || sending || !consentGiven}
                aria-label="Send message"
                className="mb-0.5 rounded-xl bg-blue-600 p-2.5 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-1.5 px-1 text-center text-[10px] leading-tight text-slate-400">
              Not for emergencies. Call 112. The assistant never diagnoses or prescribes.
            </p>
          </div>
            </>
          )}
        </section>
      ) : null}
    </>
  );
}
