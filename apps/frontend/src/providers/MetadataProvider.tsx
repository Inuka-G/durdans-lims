"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { getMetadata, AppMetadata } from "@/lib/api";

interface MetadataState {
  metadata: AppMetadata | null;
  loading: boolean;
  error: boolean;
  refresh: () => void;
}

const MetadataContext = createContext<MetadataState>({
  metadata: null,
  loading: true,
  error: false,
  refresh: () => {},
});

/**
 * Fetches /api/v1/metadata ONCE after auth and shares it via context, so the
 * RoleGuard, top nav and branch screens no longer each re-fetch it on every
 * navigation. Mounted inside AuthProvider (token ready) and above RoleGuard.
 */
export function MetadataProvider({ children }: { children: ReactNode }) {
  const [metadata, setMetadata] = useState<AppMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(false);
    getMetadata()
      .then((m) => setMetadata(m))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <MetadataContext.Provider value={{ metadata, loading, error, refresh }}>
      {children}
    </MetadataContext.Provider>
  );
}

export function useMetadata() {
  return useContext(MetadataContext);
}
