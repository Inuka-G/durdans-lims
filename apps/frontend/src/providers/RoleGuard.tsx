"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMetadata } from "@/providers/MetadataProvider";

const URL_MAP: Record<string, string> = {
    "/phlebotomy": "/phlebotomy/worklist",
    "/lab-reception": "/reception/accessioning",
    "/lab-testing": "/mlt/worklist",
    "/lab-supervision": "/verification/pending",
    "/pathology": "/clinical/worklist",
    "/report-dispatch": "/dispatch/dashboard",
    "/orders-billing": "/orders-billing/create-order",
};


// Maps backend linkUrl to the frontend route prefix it grants access to
const PREFIX_MAP: Record<string, string[]> = {
    "/phlebotomy": ["/phlebotomy"],
    "/lab-reception": ["/reception"],
    "/lab-testing": ["/mlt"],
    "/lab-supervision": ["/verification"],
    "/pathology": ["/clinical"],
    "/report-dispatch": ["/dispatch"],
    "/orders-billing": ["/orders-billing"],
    "/dashboard": ["/dashboard", "/patients", "/audit"], // Patient management uses dashboard, patients, and audit
    "/admin": ["/admin"],
    "/branch-admin": ["/branch-admin"],
};

export default function RoleGuard({ children }: { children: ReactNode }) {
    const [authorized, setAuthorized] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    // Metadata is fetched once by MetadataProvider and shared (no per-navigation refetch).
    const { metadata, loading, error } = useMetadata();

    useEffect(() => {
        if (loading) {
            setAuthorized(false);
            return;
        }
        // Fail closed: if access can't be determined, do not render the page.
        if (error) {
            router.replace("/login");
            return;
        }

        const navItems = metadata?.navItems ?? [];
        if (navItems.length === 0) {
            router.replace("/login");
            return;
        }

        const allowedPrefixes: string[] = [];
        navItems.forEach((item) => {
            const prefixes = PREFIX_MAP[item.linkUrl];
            if (prefixes) {
                allowedPrefixes.push(...prefixes);
            } else {
                allowedPrefixes.push(item.linkUrl);
            }
        });

        const hasAccess = allowedPrefixes.some((prefix) =>
            pathname === prefix || pathname.startsWith(prefix + "/")
        );

        if (!hasAccess) {
            const firstUrl = navItems[0].linkUrl;
            router.replace(URL_MAP[firstUrl] || firstUrl);
        } else {
            setAuthorized(true);
        }
    }, [pathname, router, metadata, loading, error]);

    if (!authorized) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return <>{children}</>;
}
