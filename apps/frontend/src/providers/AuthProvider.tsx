"use client";

import { ReactNode, useEffect, useState, useRef } from "react";
import keycloak from "@/lib/keycloak";

// Lightweight presence flag read by middleware.ts to gate protected routes
// server-side. Not a credential — the real token stays in the keycloak-js
// instance and the backend validates the JWT on every API call.
const SESSION_COOKIE = "kc_session";

function setSessionCookie(active: boolean) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? " Secure;" : "";
  document.cookie = active
    ? `${SESSION_COOKIE}=1; path=/; SameSite=Lax;${secure}`
    : `${SESSION_COOKIE}=; path=/; Max-Age=0; SameSite=Lax;${secure}`;
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const isRun = useRef(false);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRun.current || !keycloak) return;
    isRun.current = true;
    const kc = keycloak;

    let consecutiveFailures = 0;
    const refresh = () => {
      kc.updateToken(60)
        .then((refreshed) => {
          consecutiveFailures = 0;
          if (refreshed) setSessionCookie(true);
        })
        .catch(() => {
          // Tolerate transient network blips; only log out after repeated
          // failures (previously a single failure logged the user out mid-task).
          consecutiveFailures += 1;
          if (consecutiveFailures >= 3) {
            setSessionCookie(false);
            kc.logout();
          }
        });
    };

    kc.onTokenExpired = refresh;

    kc.init({
      onLoad: "login-required",
      pkceMethod: "S256",
      checkLoginIframe: false,
    })
      .then((auth) => {
        if (!auth) {
          setSessionCookie(false);
          window.location.reload();
          return;
        }
        setSessionCookie(true);
        // Safety-net refresh alongside onTokenExpired.
        refreshTimer.current = setInterval(refresh, 30000);
        setInitialized(true);
      })
      .catch(() => {
        console.error("Keycloak initialization failed");
      });

    return () => {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
        refreshTimer.current = null;
      }
    };
  }, []);

  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
}
