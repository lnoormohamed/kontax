"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

// Minimal toast — the app has no toast library, so admin ships its own. Mirrors
// the prototype's bottom-centre `.adm-toast`.

const ToastContext = createContext<(message: string) => void>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flash = useCallback((m: string) => {
    clearTimeout(timer.current);
    setMessage(m);
    timer.current = setTimeout(() => setMessage(null), 2800);
  }, []);

  return (
    <ToastContext.Provider value={flash}>
      {children}
      {message && (
        <div className="adm-toast" role="status">
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}
