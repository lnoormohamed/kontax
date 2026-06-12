"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaRegister() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js");
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstallPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setInstallPrompt(null);
  };

  if (!installPrompt || dismissed) return null;

  return (
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
          Install Kontax for quick access
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
        onClick={handleDismiss}
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
        ✕
      </button>
    </div>
  );
}
