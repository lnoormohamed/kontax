"use client";

import { useOptimistic, useTransition } from "react";

import { updateCardVisibility } from "~/app/actions/card-visibility";
import type { PublicCardFieldConfig } from "~/server/public-card/types";

type ResolvedFields = Required<PublicCardFieldConfig>;

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      type="button"
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        border: "none",
        background: checked ? "#17352e" : "#d8ddd6",
        position: "relative",
        cursor: disabled ? "default" : "pointer",
        flexShrink: 0,
        transition: "background 0.15s",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 21 : 3,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.15s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
        }}
      />
    </button>
  );
}

function FieldRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 0",
        borderBottom: "1px solid #f0f2ee",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#1d2823" }}>{label}</p>
        {description && (
          <p style={{ margin: "1px 0 0", fontSize: 12, color: "#8b938c" }}>{description}</p>
        )}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </label>
  );
}

export function CardSettingsClient({
  username,
  initialFields,
}: {
  username: string | null;
  initialFields: ResolvedFields;
}) {
  const [fields, setOptimistic] = useOptimistic(initialFields);
  const [, startTransition] = useTransition();

  const toggle = (key: keyof PublicCardFieldConfig) => (value: boolean) => {
    startTransition(async () => {
      setOptimistic({ ...fields, [key]: value });
      await updateCardVisibility({ [key]: value });
    });
  };

  return (
    <div>
      {/* Live card link */}
      {username && !fields.hidden && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 20,
            padding: "10px 14px",
            borderRadius: 12,
            background: "#f6f7f4",
            border: "1px solid #e9ece7",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#17352e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
          </svg>
          <a
            href={`/u/${username}`}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 13, color: "#4158f4", fontWeight: 500, textDecoration: "none" }}
          >
            kontax.app/u/{username} ↗
          </a>
        </div>
      )}

      {/* No username prompt */}
      {!username && (
        <p style={{ fontSize: 13, color: "#8b938c", marginBottom: 20 }}>
          <a href="/settings/account" style={{ color: "#4158f4" }}>Claim a username</a> to get your public card URL.
        </p>
      )}

      {/* Hide entire card */}
      <div style={{ marginBottom: 4 }}>
        <FieldRow
          label="Hide my card"
          description="Hides your card entirely — /u/{username} returns 404"
          checked={fields.hidden}
          onChange={toggle("hidden")}
        />
      </div>

      {/* Divider + section header */}
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          color: "#8b938c",
          margin: "20px 0 4px",
        }}
      >
        Fields visible on your card
      </p>

      <FieldRow label="Name" description="Always shown" checked={true} disabled />
      <FieldRow label="Photo" description="Always shown when uploaded" checked={true} disabled />
      <FieldRow label="Email address" checked={fields.showEmail} onChange={toggle("showEmail")} />
      <FieldRow label="Phone number" checked={fields.showPhone} onChange={toggle("showPhone")} />
      <FieldRow label="Company" checked={fields.showCompany} onChange={toggle("showCompany")} />
      <FieldRow label="Job title" checked={fields.showJobTitle} onChange={toggle("showJobTitle")} />
      <FieldRow label="Website" checked={fields.showWebsite} onChange={toggle("showWebsite")} />
      <FieldRow label="LinkedIn" checked={fields.showLinkedIn} onChange={toggle("showLinkedIn")} />
      <FieldRow label="Twitter / X" checked={fields.showTwitter} onChange={toggle("showTwitter")} />
    </div>
  );
}
