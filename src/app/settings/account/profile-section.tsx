"use client";

import { useRef, useState, useTransition } from "react";
import { useSession } from "next-auth/react";

import { updateProfile } from "~/app/actions/account";

const MAX_NAME = 120;

function Spinner({ size = 15, light = true }: { size?: number; light?: boolean }) {
  return (
    <span
      className="st-spin inline-block rounded-full"
      style={{
        width: size, height: size,
        border: `2px solid ${light ? "rgba(255,255,255,.35)" : "rgba(23,53,46,.2)"}`,
        borderTopColor: light ? "#fff" : "#17352e",
      }}
    />
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

const TINTS = [
  ["#e0ebe2","#356048"],["#e6e6f2","#4f4a9c"],["#f1e7dd","#8c5a36"],
  ["#dfeaf0","#356682"],["#f0e3e8","#8e4259"],["#e6eedd","#587336"],
  ["#efe8db","#7a6538"],["#deedee","#377572"],
] as const;
function tint(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h * 31 + name.charCodeAt(i)) >>> 0);
  const t = TINTS[h % TINTS.length]!;
  return [t[0], t[1]];
}

export function ProfileSection({
  initialName,
  initialAvatarUrl,
}: {
  initialName: string;
  initialAvatarUrl?: string | null;
}) {
  const { update } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(initialAvatarUrl ?? null);
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string | null>(initialAvatarUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(initialName);
  const [savedAvatar, setSavedAvatar] = useState<string | null>(initialAvatarUrl ?? null);
  const [justSaved, setJustSaved] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [touched, setTouched] = useState(false);
  const [isPending, startTransition] = useTransition();

  const remaining = MAX_NAME - name.length;
  const empty = !name.trim();
  const dirty = name !== saved || pendingAvatarUrl !== savedAvatar;
  const canSave = !empty && dirty && !isPending;

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadErr("");
    setUploading(true);
    const formData = new FormData();
    formData.set("avatar", f);
    fetch("/api/upload/avatar", { method: "POST", body: formData })
      .then((r) => r.json() as Promise<{ url?: string; error?: string }>)
      .then((data) => {
        if (data.url) {
          setPhoto(data.url);
          setPendingAvatarUrl(data.url);
        } else {
          setUploadErr(data.error === "FILE_TOO_LARGE" ? "Image must be under 2 MB."
            : data.error === "INVALID_FILE_TYPE" ? "Please upload a JPG, PNG, WebP, or GIF."
            : data.error === "UPLOAD_NOT_CONFIGURED" ? "Avatar upload is not yet configured."
            : "Upload failed. Please try again.");
        }
      })
      .catch(() => setUploadErr("Upload failed. Please try again."))
      .finally(() => setUploading(false));
    e.target.value = "";
  };

  const save = () => {
    if (!canSave) { if (empty) setTouched(true); return; }
    setSaveErr("");
    startTransition(async () => {
      const result = await updateProfile({ name, avatarUrl: pendingAvatarUrl });
      if ("success" in result) {
        setSaved(name);
        setSavedAvatar(pendingAvatarUrl);
        setJustSaved(true);
        await update(); // refresh JWT name + avatarUrl
        setTimeout(() => setJustSaved(false), 2000);
      } else {
        setSaveErr(result.error === "NAME_REQUIRED" ? "Please enter your name."
          : result.error === "NAME_TOO_LONG" ? "Name must be 120 characters or fewer."
          : result.error === "AVATAR_URL_NOT_HTTPS" ? "Avatar must be a valid HTTPS URL."
          : "Something went wrong.");
      }
    });
  };

  const [bg, fg] = tint(name || "K");

  return (
    <section className="rounded-[2rem] border border-[#d8ddd6] bg-white p-6 shadow-[0_1px_2px_rgba(20,30,25,0.04)]">
      <div className="flex flex-wrap items-center gap-5">
        {/* avatar */}
        <div className="relative h-[88px] w-[88px] shrink-0">
          {uploading ? (
            <div className="grid h-[88px] w-[88px] place-items-center rounded-full bg-[#f2f4f0]"
              style={{ animation: "stPulse 1.2s ease-in-out infinite" }}>
              <Spinner size={22} light={false} />
            </div>
          ) : photo ? (
            <img alt="Profile photo" className="h-[88px] w-[88px] rounded-full object-cover" src={photo} />
          ) : (
            <span className="grid h-[88px] w-[88px] place-items-center rounded-full text-[32px] font-semibold"
              style={{ background: bg, color: fg }}>
              {initials(name || "K")}
            </span>
          )}
        </div>

        {/* upload controls */}
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold text-[#1d2823]">Profile photo</p>
          <p className="mt-[3px] mb-3 text-[13px] leading-[1.45] text-[#5c655e]">
            PNG or JPG, up to 5&nbsp;MB. A square image works best.
          </p>
          <div className="flex flex-wrap items-center gap-[14px]">
            <input ref={fileRef} accept="image/*" className="hidden" onChange={onFile} type="file" />
            <button
              className="rounded-[1.2rem] border border-[#d8ddd6] bg-white px-4 py-[9px] text-[13.5px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0] disabled:opacity-50"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              type="button"
            >
              {photo ? "Replace photo" : "Upload photo"}
            </button>
            {photo && !uploading && (
              <button
                className="border-none bg-transparent p-0 text-[13.5px] font-medium text-[#8b938c] transition hover:text-[#b5472f]"
                onClick={() => { setPhoto(null); setPendingAvatarUrl(null); }}
                type="button"
              >
                Remove
              </button>
            )}
            {uploadErr && <p className="text-[12.5px] text-[#9a3a23]">{uploadErr}</p>}
          </div>
        </div>
      </div>

      {/* display name */}
      <div className="mt-[22px] max-w-[520px] border-t border-[#e9ece7] pt-[22px]">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#8b938c]">Display name</span>
          {remaining < 20 && (
            <span className={`tabular-nums text-[12px] ${remaining < 0 ? "text-[#9a3a23]" : "text-[#8b938c]"}`}>
              {name.length} / {MAX_NAME}
            </span>
          )}
        </div>
        <input
          className={`mt-[6px] w-full rounded-[1.2rem] border px-4 py-3 text-[14px] text-[#1d2823] outline-none transition focus:border-[#4158f4] focus:ring-[3px] focus:ring-[#edf0fe] ${touched && empty ? "border-[#c98a76]" : "border-[#d8ddd6]"}`}
          maxLength={MAX_NAME}
          onChange={(e) => { setName(e.target.value); setTouched(true); }}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          placeholder="Your name"
          type="text"
          value={name}
        />
        {touched && empty && (
          <p className="mt-[6px] text-[12.5px] text-[#9a3a23]">Please enter your name.</p>
        )}
        <p className="mt-2 text-[13px] leading-[1.45] text-[#8b938c]">
          Shown on shared contacts and inside family or team books.
        </p>

        <div className="mt-4 flex items-center gap-[14px]">
          <button
            className="inline-flex items-center gap-2 rounded-[1.2rem] bg-[#17352e] px-[18px] py-3 text-[14px] font-semibold text-white transition hover:bg-[#20443b] disabled:cursor-default disabled:opacity-45"
            disabled={!canSave}
            onClick={save}
            type="button"
          >
            {isPending ? <><Spinner size={15} /> Saving…</> : "Save changes"}
          </button>
          {saveErr && <p className="text-[12.5px] text-[#9a3a23]">{saveErr}</p>}
          {justSaved && (
            <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[#17352e]">
              <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24" width="16"><polyline points="20 6 9 17 4 12" /></svg>
              Saved
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
