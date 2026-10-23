import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const MAX_REMINDERS = 50;
const MISSED_AFTER_MS = 15 * 60 * 1000;

function readReminders(storageKey) {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(stored) ? stored.filter((item) => item && typeof item.id === "string" && typeof item.title === "string" && Number.isFinite(Date.parse(item.at))) : [];
  } catch {
    return [];
  }
}

function toLocalInputValue(isoDate) {
  const date = isoDate ? new Date(isoDate) : new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function nextOccurrence(reminder, from = Date.now()) {
  const next = new Date(reminder.at);
  const days = reminder.repeat === "weekly" ? 7 : 1;
  do {
    next.setDate(next.getDate() + days);
  } while (next.getTime() <= from);
  return next.toISOString();
}

function dismissReminder(reminder, setReminders) {
  setReminders((current) => current.map((item) => item.id === reminder.id
    ? item.repeat && item.repeat !== "never"
      ? { ...item, at: nextOccurrence(item), status: "pending", lastFiredAt: item.at }
      : { ...item, status: "done", lastFiredAt: item.at }
    : item));
}

export default function ReminderManager({ isOpen, onClose, storageKey }) {
  const [reminders, setReminders] = useState(() => readReminders(storageKey));
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState(() => toLocalInputValue());
  const [repeat, setRepeat] = useState("never");
  const [editingId, setEditingId] = useState(null);
  const notifiedIds = useRef(new Set());

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(reminders));
    } catch {
      // Keep reminders usable in memory if local storage is unavailable.
    }
  }, [reminders, storageKey]);

  useEffect(() => {
    const checkDueReminders = () => {
      const now = Date.now();
      setReminders((current) => current.map((reminder) => {
        if (reminder.status !== "pending" || Date.parse(reminder.at) > now) return reminder;
        if (now - Date.parse(reminder.at) > MISSED_AFTER_MS) {
          if (reminder.repeat !== "never") {
            return { ...reminder, at: nextOccurrence(reminder, now), status: "pending", lastMissedAt: reminder.at };
          }
          return { ...reminder, status: "missed" };
        }

        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          const occurrenceId = `${reminder.id}:${reminder.at}`;
          if (!notifiedIds.current.has(occurrenceId)) {
            try {
              new Notification("Cheeni reminder", { body: reminder.title, tag: `cheeni-${reminder.id}` });
              notifiedIds.current.add(occurrenceId);
            } catch {
              return { ...reminder, status: "due" };
            }
          }
          return reminder.repeat === "never"
            ? { ...reminder, status: "done", lastFiredAt: reminder.at }
            : { ...reminder, at: nextOccurrence(reminder, now), status: "pending", lastFiredAt: reminder.at };
        }
        return { ...reminder, status: "due" };
      }));
    };

    checkDueReminders();
    const timer = window.setInterval(checkDueReminders, 10000);
    return () => window.clearInterval(timer);
  }, []);

  const resetForm = () => {
    setTitle("");
    setScheduledAt(toLocalInputValue());
    setEditingId(null);
    setRepeat("never");
  };

  const saveReminder = (event) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    const dueDate = new Date(scheduledAt);
    if (!cleanTitle || cleanTitle.length > 120 || Number.isNaN(dueDate.getTime()) || dueDate.getTime() <= Date.now()) return;

    setReminders((current) => {
      if (editingId) {
        return current.map((reminder) => reminder.id === editingId
          ? { ...reminder, title: cleanTitle, at: dueDate.toISOString(), repeat, status: "pending" }
          : reminder);
      }
      if (current.length >= MAX_REMINDERS) return current;
      return [...current, { id: crypto.randomUUID(), title: cleanTitle, at: dueDate.toISOString(), repeat, status: "pending" }];
    });
    resetForm();
  };

  const requestNotifications = async () => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        // Browser policy may prevent requesting permission from this context.
      }
    }
  };

  const runNow = (reminder) => {
    const next = reminder.repeat === "never" ? null : nextOccurrence(reminder);
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification("Cheeni reminder", { body: reminder.title, tag: `cheeni-${reminder.id}` });
        setReminders((current) => current.map((item) => item.id === reminder.id ? (next ? { ...item, at: next, status: "pending", lastFiredAt: new Date().toISOString() } : { ...item, status: "done", lastFiredAt: new Date().toISOString() }) : item));
        return;
      } catch {
        // Fall back to an in-app reminder.
      }
    }
    setReminders((current) => current.map((item) => item.id === reminder.id ? { ...item, status: "due" } : item));
  };

  const beginEdit = (reminder) => {
    setEditingId(reminder.id);
    setTitle(reminder.title);
    setScheduledAt(toLocalInputValue(reminder.at));
    setRepeat(reminder.repeat || "never");
  };

  const dueReminder = reminders.find((reminder) => reminder.status === "due");
  const notificationPermission = typeof Notification === "undefined" ? "unsupported" : Notification.permission;
  const orderedReminders = [...reminders].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  return (
    <>
      {dueReminder && !isOpen && (
        <div role="alert" style={{ position: "fixed", bottom: 20, right: 20, zIndex: 250, maxWidth: 340, padding: 16, borderRadius: 12, background: "var(--land-bg)", border: "1px solid var(--land-rule)", boxShadow: "0 12px 36px rgba(0,0,0,.2)", color: "var(--land-ink)" }}>
          <strong>Reminder due</strong>
          <p style={{ margin: "8px 0 12px" }}>{dueReminder.title}</p>
          <button onClick={() => dismissReminder(dueReminder, setReminders)}>Dismiss</button>
        </div>
      )}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.55)" }} />
            <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} role="dialog" aria-modal="true" aria-label="Reminders" style={{ position: "fixed", zIndex: 201, top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(620px,94vw)", maxHeight: "88vh", overflowY: "auto", padding: 22, borderRadius: 16, background: "var(--land-bg)", border: "1px solid var(--land-rule)", color: "var(--land-ink)", boxShadow: "0 24px 70px rgba(0,0,0,.3)" }}>
              <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><h2 style={{ margin: 0 }}>Reminders</h2><p style={{ margin: "6px 0", color: "var(--land-ink-3)", fontSize: 13 }}>Stored in this browser only. Cheeni must be open for reminders to fire.</p></div>
                <button onClick={onClose} aria-label="Close reminders">Close</button>
              </header>
              <button onClick={requestNotifications} disabled={notificationPermission !== "default"} style={{ margin: "10px 0", opacity: notificationPermission === "default" ? 1 : .65 }}>
                {notificationPermission === "granted" ? "Browser notifications enabled" : notificationPermission === "denied" ? "Notifications blocked in browser settings" : notificationPermission === "unsupported" ? "Browser notifications unavailable" : "Enable browser notifications"}
              </button>
              <form onSubmit={saveReminder} style={{ display: "grid", gridTemplateColumns: "1fr 220px auto", gap: 8, margin: "12px 0 18px" }}>
                <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Reminder text" required aria-label="Reminder text" />
                <input type="datetime-local" value={scheduledAt} min={toLocalInputValue()} onChange={(event) => setScheduledAt(event.target.value)} required aria-label="Reminder time" />
                <select value={repeat} onChange={(event) => setRepeat(event.target.value)} aria-label="Repeat reminder">
                  <option value="never">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
                <button type="submit">{editingId ? "Save" : "Add"}</button>
                {editingId && <button type="button" onClick={resetForm}>Cancel edit</button>}
              </form>
              {reminders.length >= MAX_REMINDERS && <p role="status">Reminder limit reached ({MAX_REMINDERS}). Delete old reminders to add more.</p>}
              <div style={{ display: "grid", gap: 8 }}>
                {orderedReminders.map((reminder) => (
                  <article key={reminder.id} style={{ padding: 12, border: "1px solid var(--land-rule)", borderRadius: 10 }}>
                    <strong>{reminder.title}</strong>
                    <div style={{ margin: "4px 0 8px", fontSize: 12, color: "var(--land-ink-3)" }}>{new Date(reminder.at).toLocaleString()} · {reminder.repeat && reminder.repeat !== "never" ? `${reminder.repeat}, ` : ""}{reminder.status}</div>
                    {reminder.status === "pending" && <button onClick={() => setReminders((current) => current.map((item) => item.id === reminder.id ? { ...item, status: "paused" } : item))}>Pause</button>}
                    {reminder.status === "paused" && <button onClick={() => setReminders((current) => current.map((item) => item.id === reminder.id ? { ...item, status: "pending" } : item))}>Resume</button>}
                    {(reminder.status === "pending" || reminder.status === "paused") && <><button onClick={() => beginEdit(reminder)}>Edit</button><button onClick={() => runNow(reminder)}>Run now</button></>}
                    {reminder.status === "due" && <button onClick={() => dismissReminder(reminder, setReminders)}>Dismiss</button>}
                    <button onClick={() => setReminders((current) => current.filter((item) => item.id !== reminder.id))}>Delete</button>
                  </article>
                ))}
                {reminders.length === 0 && <p style={{ color: "var(--land-ink-3)" }}>No reminders yet.</p>}
              </div>
            </motion.section>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
