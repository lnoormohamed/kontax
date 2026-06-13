"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const INSTALL_PROMPT_DISMISSED_KEY = "kontax:pwa-install-dismissed-at";
const IOS_INSTALL_PROMPT_DISMISSED_KEY = "kontax:pwa-ios-install-dismissed-at";
const INSTALL_PROMPT_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

const canShowPrompt = (key: string) => {
  const dismissedAt = Number(localStorage.getItem(key) ?? "0");
  return !Number.isFinite(dismissedAt) || Date.now() - dismissedAt > INSTALL_PROMPT_COOLDOWN_MS;
};

const isMobileInstallSurface = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(max-width: 767px)").matches ||
    /android|iphone|ipad|ipod/i.test(navigator.userAgent));

const isIosSafari = () =>
  typeof navigator !== "undefined" &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  /safari/i.test(navigator.userAgent) &&
  !/crios|fxios|edgios/i.test(navigator.userAgent) &&
  !(window as unknown as Record<string, unknown>).MSStream;

const isInStandaloneMode = () =>
  typeof window !== "undefined" &&
  ("standalone" in window.navigator
    ? (window.navigator as unknown as { standalone: boolean }).standalone
    : window.matchMedia("(display-mode: standalone)").matches);

function AppTile() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: "#17352e",
          display: "grid",
          placeItems: "center",
          fontSize: 28,
          fontWeight: 800,
          color: "#dff0e7",
          letterSpacing: "-0.02em",
        }}
      >
        K
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2823" }}>Kontax</div>
        <div style={{ fontSize: 12, color: "#8b938c" }}>kontax.app</div>
      </div>
    </div>
  );
}

export function PwaRegister() {
  const router = useRouter();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
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
      if (isMobileInstallSurface() && canShowPrompt(INSTALL_PROMPT_DISMISSED_KEY)) {
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

  // iOS Safari has no beforeinstallprompt event, so show manual instructions on
  // the same 30-day cadence while outside installed standalone mode.
  useEffect(() => {
    if (
      isMobileInstallSurface() &&
      isIosSafari() &&
      !isInStandaloneMode() &&
      canShowPrompt(IOS_INSTALL_PROMPT_DISMISSED_KEY)
    ) {
      setShowIosGuide(true);
    }
  }, []);

  const handleDismissIosGuide = () => {
    localStorage.setItem(IOS_INSTALL_PROMPT_DISMISSED_KEY, String(Date.now()));
    setShowIosGuide(false);
  };

  return (
    <>
      {/* Android/Chrome install prompt — bottom sheet, capped to once every 30 days after dismissal. */}
      {installPrompt ? (
        <div
          aria-modal="true"
          role="dialog"
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
            <AppTile />
            <p style={{ margin: "16px 0 6px", fontSize: 17, fontWeight: 700, color: "#1d2823", textAlign: "center" }}>
              Add Kontax to your Home Screen
            </p>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: "#5c655e", lineHeight: 1.5, textAlign: "center" }}>
              Install for quick, app-like access to your contacts.
            </p>
            <button
              onClick={handleInstall}
              style={{
                width: "100%",
                height: 50,
                borderRadius: 14,
                background: "#4158f4",
                color: "#fff",
                border: "none",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                marginBottom: 10,
              }}
              type="button"
            >
              Install
            </button>
            <button
              onClick={handleDismissInstall}
              style={{
                width: "100%",
                height: 44,
                borderRadius: 14,
                background: "transparent",
                color: "#5c655e",
                border: "1.5px solid #d8ddd6",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
              type="button"
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}

      {/* iOS Safari install guide — manual instructions, capped to once every 30 days. */}
      {showIosGuide ? (
        <div
          aria-modal="true"
          role="dialog"
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
            <AppTile />
            <p style={{ margin: "16px 0 6px", fontSize: 17, fontWeight: 700, color: "#1d2823", textAlign: "center" }}>
              Add Kontax to your Home Screen
            </p>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#5c655e", lineHeight: 1.5, textAlign: "center" }}>
              Open your contacts faster from the iPhone Home Screen.
            </p>
            <ol style={{ margin: "0 0 24px", padding: "0 0 0 20px", fontSize: 14, color: "#1d2823", lineHeight: 2 }}>
              <li>
                Tap the <strong>Share</strong> button in Safari.
              </li>
              <li>
                Choose <strong>Add to Home Screen</strong>.
              </li>
              <li>
                Tap <strong>Add</strong> to confirm.
              </li>
            </ol>
            <button
              onClick={handleDismissIosGuide}
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
