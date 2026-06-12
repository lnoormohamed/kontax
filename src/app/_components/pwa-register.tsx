"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Detect iOS Safari (no beforeinstallprompt support).
const isIos = () =>
  typeof navigator !== "undefined" &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !(window as unknown as Record<string, unknown>).MSStream;

const isInStandaloneMode = () =>
  typeof window !== "undefined" &&
  ("standalone" in window.navigator
    ? (window.navigator as unknown as { standalone: boolean }).standalone
    : window.matchMedia("(display-mode: standalone)").matches);

export function PwaRegister() {
  const router = useRouter();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

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

  // Capture the install prompt (Android/Chrome).
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // On iOS, show the manual-install guidance if not already installed.
  useEffect(() => {
    if (isIos() && !isInStandaloneMode()) {
      const dismissed = localStorage.getItem("pwa-ios-dismissed");
      if (!dismissed) setShowIosGuide(true);
    }
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

  const handleIosDismiss = () => {
    localStorage.setItem("pwa-ios-dismissed", "1");
    setShowIosGuide(false);
  };

  return (
    <>
      {/* Android/Chrome install prompt */}
      {installPrompt && !dismissed ? (
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
              Install Kontax for quick, offline access
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
            aria-label="Dismiss"
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
      ) : null}

      {/* iOS Safari install guidance */}
      {showIosGuide ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "flex-end",
            padding: "0 0 env(safe-area-inset-bottom)",
          }}
        >
          <div
            style={{
              width: "100%",
              background: "#fff",
              borderRadius: "20px 20px 0 0",
              padding: "24px 24px 32px",
            }}
          >
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "#d8ddd6", margin: "0 auto 20px" }} />
            <p style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: "#1d2823" }}>
              Add Kontax to your Home Screen
            </p>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#5c655e", lineHeight: 1.5 }}>
              Access your contacts instantly, even without an internet connection.
            </p>
            <ol style={{ margin: "0 0 24px", padding: "0 0 0 20px", fontSize: 14, color: "#1d2823", lineHeight: 2 }}>
              <li>
                Tap the <strong>Share</strong> button{" "}
                <span aria-label="share icon" style={{ fontSize: 16 }}>⬆</span> in Safari
              </li>
              <li>
                Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>
              </li>
              <li>Tap <strong>Add</strong> to confirm</li>
            </ol>
            <button
              onClick={handleIosDismiss}
              style={{
                width: "100%",
                height: 50,
                borderRadius: 14,
                background: "#17352e",
                color: "#fff",
                border: "none",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
              type="button"
            >
              Got it
            </button>
          </div>
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
