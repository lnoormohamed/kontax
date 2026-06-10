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
    <button
      aria-label="Undo this import (archives its contacts)"
      className="text-[13px] font-semibold text-[#5c655e] transition hover:text-[#b5472f] disabled:opacity-50"
      disabled={isRollingBack}
      onClick={handleRollback}
      title={error || "Undo this import (archives its contacts)"}
      type="button"
    >
      {isRollingBack ? "Archiving…" : "Undo"}
    </button>
  );
}
