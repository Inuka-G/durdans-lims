"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/providers/ThemeProvider";

/** Sonner toaster that follows the app theme (class-based), not only the OS. */
export default function ThemedToaster() {
    const { resolved } = useTheme();
    return <Toaster position="top-right" theme={resolved} richColors closeButton />;
}
