"use client";

import { useState, useTransition } from "react";

import { broadcastProductUpdate } from "~/app/actions/admin";
import { useToast } from "../_components/toast";

const ERRORS: Record<string, string> = {
  FORBIDDEN: "You don't have permission to broadcast.",
  TITLE_REQUIRED: "Enter a title.",
  BODY_REQUIRED: "Enter a message body.",
};

/**
 * P22-DB05: admin product-update broadcast. Sends a PRODUCT_UPDATES notification
 * to every active user (each user's in-app preference is honoured server-side).
 */
export function BroadcastForm() {
  const flash = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [pending, startTransition] = useTransition();

  const send = () => {
    startTransition(async () => {
      const res = await broadcastProductUpdate({ title, body, actionUrl });
      if ("error" in res) {
        flash(ERRORS[res.error] ?? "Something went wrong.");
        return;
      }
      flash(`Sent to ${res.recipients} ${res.recipients === 1 ? "user" : "users"}.`);
      setTitle("");
      setBody("");
      setActionUrl("");
    });
  };

  const disabled = pending || title.trim().length === 0 || body.trim().length === 0;

  return (
    <div className="ad-card" style={{ maxWidth: 600 }}>
      <div className="ad-card-head">
        <h2 className="ad-card-title">Product update broadcast</h2>
      </div>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "#5c655e", lineHeight: 1.5 }}>
        Sends a <strong>Product updates</strong> notification to every active user. Users who turned
        off in-app product updates won&apos;t receive it. This can&apos;t be recalled.
      </p>

      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#1d2823", marginBottom: 6 }}>
        Title
      </label>
      <input
        className="ad-text-input"
        maxLength={120}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New: one-pass duplicate merge"
        value={title}
      />

      <label
        style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#1d2823", margin: "16px 0 6px" }}
      >
        Message
      </label>
      <textarea
        className="ad-textarea"
        maxLength={280}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Clean up duplicate contacts in a single review."
        rows={3}
        value={body}
      />

      <label
        style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#1d2823", margin: "16px 0 6px" }}
      >
        Link <span style={{ fontWeight: 400, color: "#8b938c" }}>(optional)</span>
      </label>
      <input
        className="ad-text-input"
        onChange={(e) => setActionUrl(e.target.value)}
        placeholder="/merge/manual"
        value={actionUrl}
      />

      <div style={{ marginTop: 20 }}>
        <button className="ad-btn ad-btn--primary" disabled={disabled} onClick={send} type="button">
          {pending ? "Sending…" : "Send broadcast"}
        </button>
      </div>
    </div>
  );
}
