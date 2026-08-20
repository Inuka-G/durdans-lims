"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";

import { DEFAULT_THEME, THEME_STORAGE_KEY, type ResolvedTheme, type ThemePreference } from "@/lib/theme";

export type { ResolvedTheme, ThemePreference };

/**
 * The theme lives outside React: localStorage holds the preference and the OS
 * holds `prefers-color-scheme`. We read it with useSyncExternalStore so the very
 * first client render already has the right value (the inline boot script in
 * app/layout.tsx has painted the `.dark` class before this ever runs), instead
 * of rendering "light" and correcting it in an effect.
 */

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(onChange: () => void) {
    listeners.add(onChange);
    const onStorage = (e: StorageEvent) => {
        if (e.key === THEME_STORAGE_KEY) notify();
    };
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    window.addEventListener("storage", onStorage);
    mq.addEventListener("change", notify);
    return () => {
        listeners.delete(onChange);
        window.removeEventListener("storage", onStorage);
        mq.removeEventListener("change", notify);
    };
}

/** Both snapshots return primitives, so React can compare them by value. */
function getPreference(): ThemePreference {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : DEFAULT_THEME;
}

function getResolved(): ResolvedTheme {
    const pref = getPreference();
    if (pref !== "system") return pref;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const serverPreference = () => DEFAULT_THEME;
const serverResolved = (): ResolvedTheme => (DEFAULT_THEME === "dark" ? "dark" : "light");

function applyClass(resolved: ResolvedTheme) {
    const classes = document.documentElement.classList;
    if (resolved === "dark") classes.add("dark");
    else classes.remove("dark");
}

interface ThemeState {
    theme: ThemePreference;
    resolved: ResolvedTheme;
    setTheme: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeState>({
    theme: DEFAULT_THEME,
    resolved: serverResolved(),
    setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
    const theme = useSyncExternalStore(subscribe, getPreference, serverPreference);
    const resolved = useSyncExternalStore(subscribe, getResolved, serverResolved);

    // Keep the <html> class in step with the store — for the OS flipping while in
    // "system" mode, and for another tab changing the preference. setTheme applies
    // it synchronously, so this is a no-op in the common case.
    useEffect(() => {
        applyClass(resolved);
    }, [resolved]);

    const setTheme = useCallback((next: ThemePreference) => {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
        applyClass(next === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : next);
        notify();
    }, []);

    const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    return useContext(ThemeContext);
}
