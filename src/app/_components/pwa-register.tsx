"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function PwaRegister() {
  const router = useRouter();
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  // Register service worker + wire up update notification + reconnect refresh.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js");

    // Show a "new version" banner when the SW sends SW_UPDATED.
    navigator.serviceWorker.addEventListener("message", (e) => {
      if ((e.data as { type?: string })?.type === "SW_UPDATED") {
        setShowUpdateBanner(true);
      }
    });

    // Refresh server-component data when the connection is restored.
    const handleOnline = () => router.refresh();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [router]);

  // Suppress unsolicited browser install prompts. Install guidance should be a
  // deliberate Settings action, not something that appears while users pull to
  // refresh or navigate the mobile contact list.
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  return (
    <>
      {/* SW update banner */}
      {showUpdateBanner ? (
        <div
          role="status"
          style={{
            position: "fixed",
            top: `calc(env(safe-area-inset-top) + 12px)`,
            left: 16,
            right: 16,
            zIndex: 100,
            background: "#1d2823",
            color: "#fff",
            borderRadius: 12,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            maxWidth: 420,
            margin: "0 auto",
          }}
        >
          <span style={{ fontSize: 14 }}>A new version is available.</span>
          <button
            onClick={() => window.location.reload()}
            style={{
              flexShrink: 0,
              height: 32,
              padding: "0 12px",
              borderRadius: 8,
              background: "#4158f4",
              color: "#fff",
              border: "none",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
            type="button"
          >
            Reload
          </button>
          <button
            aria-label="Dismiss"
            onClick={() => setShowUpdateBanner(false)}
            style={{
              flexShrink: 0,
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.12)",
              color: "#fff",
              border: "none",
              fontSize: 13,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
            type="button"
          >
            ✕
          </button>
        </div>
      ) : null}
    </>
  );
}
