"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const INSTALL_PROMPT_DISMISSED_KEY = "kontax:pwa-install-dismissed-at";
const INSTALL_PROMPT_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

const canShowInstallPrompt = () => {
  const dismissedAt = Number(localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY) ?? "0");
  return !Number.isFinite(dismissedAt) || Date.now() - dismissedAt > INSTALL_PROMPT_COOLDOWN_MS;
};

export function PwaRegister() {
  const router = useRouter();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
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

  // Capture Chrome's install event and show our own quiet prompt at most once
  // every 30 days after dismissal.
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      if (canShowInstallPrompt()) {
        setInstallPrompt(e as BeforeInstallPromptEvent);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
    } else {
      localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, String(Date.now()));
      setInstallPrompt(null);
    }
  };

  const handleDismissInstall = () => {
    localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, String(Date.now()));
    setInstallPrompt(null);
  };

  return (
    <>
      {/* Android/Chrome install prompt — capped to once every 30 days after dismissal. */}
      {installPrompt ? (
        <div
          role="alert"
          style={{
            position: "fixed",
            bottom: `calc(env(safe-area-inset-bottom) + 16px)`,
            left: 16,
            right: 16,
            zIndex: 100,
            background: "#17352e",
            color: "#fff",
            borderRadius: 16,
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            boxShadow: "0 8px 24px rgba(23,53,46,0.32)",
            maxWidth: 420,
            margin: "0 auto",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Add to Home Screen</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
              Install Kontax for quick, app-like access
            </p>
          </div>
          <button
            onClick={handleInstall}
            style={{
              flexShrink: 0,
              height: 36,
              padding: "0 14px",
              borderRadius: 9,
              background: "#fff",
              color: "#17352e",
              border: "none",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
            type="button"
          >
            Install
          </button>
          <button
            aria-label="Dismiss install prompt"
            onClick={handleDismissInstall}
            style={{
              flexShrink: 0,
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              border: "none",
              fontSize: 14,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
            type="button"
          >
            x
          </button>
        </div>
      ) : null}

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
