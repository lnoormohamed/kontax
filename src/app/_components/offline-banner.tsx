"use client";

import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      style={{
        backgroundColor: "#f6edd9",
        borderBottom: "1px solid #e8d8b0",
        padding: "9px 16px",
        fontSize: 13,
        color: "#7a5a1a",
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontWeight: 500,
      }}
    >
      <span aria-hidden style={{ fontSize: 14 }}>⚠</span>
      You&apos;re offline — showing your last synced contacts.
    </div>
  );
}
