"use client";

import { useState } from "react";

import { ConfirmDialog } from "~/app/_components/confirm-dialog";

// P24B-05 demo — destructive + neutral confirm dialogs.

export default function ConfirmDialogWireframe() {
  const [destructiveOpen, setDestructiveOpen] = useState(false);
  const [neutralOpen, setNeutralOpen] = useState(false);

  const btn: React.CSSProperties = {
    height: 46,
    padding: "0 18px",
    borderRadius: 12,
    border: "1px solid #d8ddd6",
    background: "#fff",
    fontSize: 15,
    fontWeight: 600,
    color: "#1d2823",
    cursor: "pointer",
  };

  return (
    <div style={{ background: "#f6f7f4", minHeight: "100dvh", padding: 16, display: "flex", flexDirection: "column", gap: 12, fontFamily: "Geist, system-ui, sans-serif" }}>
      <button type="button" style={btn} onClick={() => setDestructiveOpen(true)}>
        Open destructive confirm (Leave family)
      </button>
      <button type="button" style={btn} onClick={() => setNeutralOpen(true)}>
        Open neutral confirm (Archive all)
      </button>

      <ConfirmDialog
        open={destructiveOpen}
        onClose={() => setDestructiveOpen(false)}
        onConfirm={() => setDestructiveOpen(false)}
        title="Leave Okafor Family?"
        body="You'll lose access to the shared family book. The owner can invite you again later."
        confirmLabel="Leave family"
        destructive
      />
      <ConfirmDialog
        open={neutralOpen}
        onClose={() => setNeutralOpen(false)}
        onConfirm={() => setNeutralOpen(false)}
        title="Archive 12 contacts?"
        body="They'll move to Archived and stay searchable. You can restore them anytime."
        confirmLabel="Archive"
      />
    </div>
  );
}
