"use client";

import { useState } from "react";

type Subject = "general" | "billing" | "technical" | "feature" | "security";

const SUBJECTS: { value: Subject; label: string }[] = [
  { value: "general", label: "General enquiry" },
  { value: "billing", label: "Billing question" },
  { value: "technical", label: "Technical issue" },
  { value: "feature", label: "Feature request" },
  { value: "security", label: "Security report" },
];

type Status = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [subject, setSubject] = useState<Subject | "">("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      subject: (form.elements.namedItem("subject") as HTMLSelectElement).value,
      message: (form.elements.namedItem("message") as HTMLTextAreaElement)
        .value,
      website: (form.elements.namedItem("website") as HTMLInputElement).value,
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok || !json.success) {
        setErrorMsg(
          json.error ?? "Something went wrong. Please try again.",
        );
        setStatus("error");
        return;
      }
      setStatus("success");
    } catch {
      setErrorMsg("Could not reach the server. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="ct-success">
        <div className="ct-success__icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.2 4.2L19 7" />
          </svg>
        </div>
        <h2 className="ct-success__title">Message sent!</h2>
        <p className="ct-success__sub">
          Thanks for reaching out. We&apos;ll get back to you within 1 business day.
        </p>
        <button
          className="ct-btn"
          onClick={() => setStatus("idle")}
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form className="ct-form" onSubmit={handleSubmit} noValidate>
      {/* Honeypot */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", opacity: 0, height: 0, width: 0, pointerEvents: "none" }}
      />

      <div className="ct-field">
        <label className="ct-label" htmlFor="ct-name">Name</label>
        <input
          id="ct-name"
          className="ct-input"
          type="text"
          name="name"
          required
          autoComplete="name"
          placeholder="Your name"
        />
      </div>

      <div className="ct-field">
        <label className="ct-label" htmlFor="ct-email">Email</label>
        <input
          id="ct-email"
          className="ct-input"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>

      <div className="ct-field">
        <label className="ct-label" htmlFor="ct-subject">Subject</label>
        <select
          id="ct-subject"
          className="ct-select"
          name="subject"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value as Subject)}
        >
          <option value="" disabled>Choose one…</option>
          {SUBJECTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        {subject === "security" && (
          <p className="ct-field__note">
            For security vulnerabilities, you may also email{" "}
            <a href="mailto:security@getkontax.com">security@getkontax.com</a>{" "}
            directly.
          </p>
        )}
      </div>

      <div className="ct-field">
        <label className="ct-label" htmlFor="ct-message">Message</label>
        <textarea
          id="ct-message"
          className="ct-textarea"
          name="message"
          required
          minLength={20}
          rows={6}
          placeholder="Tell us what's on your mind…"
        />
      </div>

      {status === "error" && (
        <p className="ct-error" role="alert">{errorMsg}</p>
      )}

      <button
        className="ct-btn"
        type="submit"
        disabled={status === "submitting"}
      >
        {status === "submitting" ? "Sending…" : "Send message →"}
      </button>
    </form>
  );
}
