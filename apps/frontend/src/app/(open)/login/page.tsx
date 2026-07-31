"use client";

import { useEffect, useRef } from "react";
import keycloak from "@/lib/keycloak";

/**
 * Initiates the Keycloak sign-in. The middleware redirects unauthenticated users
 * here (with a `from` query param); this page runs the Keycloak login-required
 * flow, sets the session-presence cookie on success, and returns the user to the
 * page they originally requested.
 */
export default function LoginPage() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !keycloak) return;
    ran.current = true;

    const from = new URLSearchParams(window.location.search).get("from") || "/dashboard";

    keycloak
      .init({ onLoad: "login-required", pkceMethod: "S256", checkLoginIframe: false })
      .then((authenticated) => {
        if (authenticated) {
          const secure = window.location.protocol === "https:" ? " Secure;" : "";
          document.cookie = `kc_session=1; path=/; SameSite=Lax;${secure}`;
          window.location.replace(from.startsWith("/") ? from : "/dashboard");
        }
      })
      .catch(() => {
        // init failure — the user can retry by reloading.
      });
  }, []);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="text-sm font-semibold text-slate-500">Redirecting to sign in…</p>
      </div>
    </div>
  );
}
