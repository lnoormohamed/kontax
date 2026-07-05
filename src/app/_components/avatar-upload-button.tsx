"use client";

import { useRef, useState } from "react";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";

/**
 * P46-04 — file upload for a contact (or profile) photo. Posts to the P46-03
 * optimized route (`/api/upload/avatar`), which normalizes the image, stores
 * the canonical + thumb, discards the raw original, and (given `currentUrl`)
 * cleans up the superseded Kontax-hosted object. On success it hands the new
 * Kontax-hosted URL to `onUploaded`; the caller writes it to `avatarUrl`.
 *
 * Coexists with the URL-paste field — this is an addition, not a replacement.
 */
const MAX_BYTES = 2 * 1024 * 1024;

function errorText(code: string | undefined): string {
  switch (code) {
    case "FILE_TOO_LARGE":
      return "Image must be under 2 MB.";
    case "INVALID_FILE_TYPE":
      return "Please upload a JPG, PNG, WebP, or GIF.";
    case "INVALID_IMAGE":
      return "That image couldn't be read. Try another file.";
    case "UPLOAD_NOT_CONFIGURED":
      return "Photo upload isn't available right now.";
    default:
      return "Upload failed. Please try again.";
  }
}

export function AvatarUploadButton({
  currentUrl,
  onUploaded,
  className,
  label = "Upload photo",
}: {
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setErr("");
    if (file.size > MAX_BYTES) {
      setErr(errorText("FILE_TOO_LARGE"));
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.set("avatar", file);
    if (currentUrl) formData.set("prevUrl", currentUrl);
    fetch("/api/upload/avatar", { method: "POST", body: formData })
      .then((r) => r.json() as Promise<{ url?: string; error?: string }>)
      .then((data) => {
        if (data.url) onUploaded(data.url);
        else setErr(errorText(data.error));
      })
      .catch(() => setErr(errorText(undefined)))
      .finally(() => setUploading(false));
  };

  return (
    <div className={className}>
      <input
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={onFile}
        ref={ref}
        type="file"
      />
      <button
        className="inline-flex items-center gap-1.5 rounded-[0.7rem] border border-[#d8ddd6] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#17352e] transition hover:bg-[#f2f4f0] disabled:opacity-60"
        disabled={uploading}
        onClick={() => ref.current?.click()}
        type="button"
      >
        <WorkspaceIcon name={uploading ? "clock" : "upload"} size={15} />
        {uploading ? "Uploading…" : label}
      </button>
      {err ? <p className="mt-1 text-[12px] text-[#b5472f]">{err}</p> : null}
    </div>
  );
}
