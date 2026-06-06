"use client";

import { useState } from "react";

type ImportJobRollbackButtonProps = {
  jobId: string;
};

export function ImportJobRollbackButton({ jobId }: ImportJobRollbackButtonProps) {
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [error, setError] = useState("");

  const handleRollback = async () => {
    setIsRollingBack(true);
    setError("");

    const response = await fetch("/api/imports/contacts/rollback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jobId }),
    });

    const data = (await response.json().catch(() => null)) as { message?: string } | null;

    if (!response.ok) {
      setError(data?.message ?? "Rollback failed.");
      setIsRollingBack(false);
      return;
    }

    window.location.href = "/import-export?rolledBack=1";
  };

  return (
    <div className="mt-3 grid gap-2">
      <button
        className="rounded-full border border-amber-300/30 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-200 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isRollingBack}
        onClick={handleRollback}
        type="button"
      >
        {isRollingBack ? "Archiving imported contacts..." : "Archive imported contacts"}
      </button>
      {error ? <p className="text-sm text-rose-200">{error}</p> : null}
    </div>
  );
}
