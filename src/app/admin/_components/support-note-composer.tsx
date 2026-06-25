"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { addAdminSupportNote } from "~/app/actions/admin";
import { useToast } from "./toast";
import { AdIcon } from "./admin-icons";

export function SupportNoteComposer({
  subjectType,
  subjectId,
  targetUserId,
  placeholder,
}: {
  subjectType: string;
  subjectId: string;
  targetUserId?: string | null;
  placeholder: string;
}) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const flash = useToast();

  const submit = () => {
    if (!body.trim()) return;
    setErr(null);
    startTransition(async () => {
      const result = await addAdminSupportNote({
        subjectType,
        subjectId,
        targetUserId: targetUserId ?? null,
        body,
      });
      if ("error" in result) {
        setErr(result.error === "REASON_REQUIRED" ? "A note is required." : "Couldn’t save the note.");
        return;
      }
      setBody("");
      flash("Support note saved");
      router.refresh();
    });
  };

  return (
    <div className="ad-support-composer">
      <textarea
        className="ad-textarea"
        rows={3}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={placeholder}
        disabled={pending}
      />
      {err ? <div className="ad-field-hint" style={{ color: "#b91c1c" }}>{err}</div> : null}
      <div className="ad-support-composer__foot">
        <button className="ad-btn ad-btn--primary ad-btn--sm" onClick={submit} disabled={pending || !body.trim()}>
          {pending ? <AdIcon name="spinner" size={14} c="#fff" spin /> : null}
          <span>{pending ? "Saving…" : "Add note"}</span>
        </button>
      </div>
    </div>
  );
}
