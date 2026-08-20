import type { Metadata } from "next";
import { ThemeProvider } from "@/providers/ThemeProvider";
import ThemedToaster from "@/providers/ThemedToaster";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
    title: "Durdans Hospital ERP",
    description: "Laboratory Information Management System",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                {/* Applies the saved theme before first paint (no flash). */}
                <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
                <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
                <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
            </head>
            <body className="font-display antialiased" suppressHydrationWarning>
                <ThemeProvider>
                    <ThemedToaster />
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}
