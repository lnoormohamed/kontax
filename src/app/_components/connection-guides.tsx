"use client";

import { useState } from "react";

type Platform = "iphone" | "macos" | "android";

type GuideStep = { text: string; fields?: Array<{ label: string; value: string }> };

const PLATFORMS: Array<{ id: Platform; label: string }> = [
  { id: "iphone", label: "iPhone / iPad" },
  { id: "macos", label: "macOS" },
  { id: "android", label: "Android (DAVx⁵)" },
];

function ValueChip({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mt-1 flex items-center gap-2 rounded-[0.9rem] border border-[#d8ddd6] bg-[#f8faf8] px-3 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </span>
      <span className="min-w-0 flex-1 break-all font-mono text-xs text-slate-900">{value}</span>
      <button
        aria-label={`Copy ${label.toLowerCase()}`}
        className="shrink-0 rounded-[0.7rem] border border-[#d8ddd6] bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
        onClick={handleCopy}
        type="button"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function ConnectionGuides({
  serverUrl,
  email,
}: {
  serverUrl: string;
  email: string;
}) {
  const [active, setActive] = useState<Platform>("iphone");

  const guides: Record<Platform, GuideStep[]> = {
    iphone: [
      { text: "Open the Settings app." },
      { text: "Scroll down and tap “Contacts”." },
      { text: "Tap “Accounts”, then “Add Account”." },
      { text: "Tap “Other”, then “Add CardDAV Account”." },
      {
        text: "Enter these details:",
        fields: [
          { label: "Server", value: serverUrl },
          { label: "User Name", value: email },
          { label: "Password", value: "your app password (created above)" },
          { label: "Description", value: "Kontax" },
        ],
      },
      { text: "Tap “Next”. Your contacts will start syncing automatically." },
    ],
    macos: [
      { text: "Open System Settings." },
      { text: "Click “Internet Accounts”." },
      { text: "Click “Add Account…”, then “Other Accounts…”." },
      { text: "Click “CardDAV account”." },
      {
        text: "Set Account Type to “Advanced”, then enter:",
        fields: [
          { label: "User Name", value: email },
          { label: "Password", value: "your app password (created above)" },
          { label: "Server Address", value: serverUrl },
        ],
      },
      { text: "Click “Sign In”." },
    ],
    android: [
      { text: "Install DAVx⁵ from the Play Store." },
      { text: "Open DAVx⁵ and tap the + button." },
      { text: "Select “Login with URL and user name”." },
      {
        text: "Enter:",
        fields: [
          { label: "Base URL", value: serverUrl },
          { label: "User name", value: email },
          { label: "Password", value: "your app password (created above)" },
        ],
      },
      { text: "Tap “Login”." },
      { text: "Select the “Contacts” address book and tap “Synchronize”." },
    ],
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((platform) => (
          <button
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              active === platform.id
                ? "border-[#17352e] bg-[#17352e] text-white"
                : "border-[#d8ddd6] bg-white text-slate-600 hover:bg-slate-50"
            }`}
            key={platform.id}
            onClick={() => setActive(platform.id)}
            type="button"
          >
            {platform.label}
          </button>
        ))}
      </div>

      <ol className="mt-5 grid gap-4">
        {guides[active].map((step, index) => (
          <li className="flex gap-3" key={index}>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e3e8ff] text-xs font-semibold text-[#4158f4]">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-6 text-slate-700">{step.text}</p>
              {step.fields?.map((field) => (
                <ValueChip key={field.label} label={field.label} value={field.value} />
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
