/**
 * Theme constants shared by the server root layout (boot script) and the
 * client ThemeProvider. Keep this file free of "use client" so the string can
 * be inlined into <head> by a server component.
 */
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "lims-theme";

/**
 * Inline boot script for <head>: applies the stored theme before first paint so
 * there is no light→dark flash. Tiny and dependency-free on purpose.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var c=document.documentElement.classList;d?c.add("dark"):c.remove("dark");}catch(e){}})();`;

/**
 * Default when nothing is stored. "light" (not "system") on purpose: modules
 * outside Patient Management are not dark-ready yet, so dark is opt-in.
 */
export const DEFAULT_THEME: ThemePreference = "light";
