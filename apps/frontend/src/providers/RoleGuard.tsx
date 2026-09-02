"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMetadata } from "@/providers/MetadataProvider";
import { useAuth } from "@/hooks/useAuth";

const URL_MAP: Record<string, string> = {
    "/phlebotomy": "/phlebotomy/worklist",
    "/lab-reception": "/reception/accessioning",
    "/lab-testing": "/mlt/worklist",
    "/lab-supervision": "/verification/pending",
    "/pathology": "/clinical/worklist",
    "/report-dispatch": "/dispatch/dashboard",
    "/orders-billing": "/orders-billing/create-order",
    // Same /admin, /branch-admin mismatch PREFIX_MAP below already documents —
    // this map feeds the *redirect target* when the current page isn't one of
    // the caller's allowed prefixes (line ~76), so it needs the identical fix
    // or a user landing on their default page 404s exactly like the access
    // check used to.
    "/admin": "/superadmin",
    "/branch-admin": "/branch",
};

const ROLE_TO_URL: Record<string, string> = {
    "SUPER_ADMIN": "/admin",
    "BRANCH_ADMIN": "/branch-admin",
    "PHLEBOTOMIST": "/phlebotomy",
    "LAB_RECEPTIONIST": "/lab-reception",
    "MLT": "/lab-testing",
    "LAB_SUPERVISOR": "/lab-supervision",
    "PATHOLOGIST": "/pathology",
    "DISPATCH_OFFICER": "/report-dispatch",
    "BILLING_OFFICER": "/orders-billing",
    "FRONT_DESK": "/dashboard",
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
    // The seeded nav items are /admin and /branch-admin, but the App Router
    // segments are (protected)/superadmin and (protected)/branch. Mapping these
    // to themselves silently locked every admin screen behind a 404 — including
    // every page for a user holding only SUPER_ADMIN.
    "/admin": ["/superadmin"],
    "/branch-admin": ["/branch"],
};

export default function RoleGuard({ children }: { children: ReactNode }) {
    const [authorized, setAuthorized] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    // Metadata is fetched once by MetadataProvider and shared (no per-navigation refetch).
    const { metadata, loading, error } = useMetadata();
    const { roles } = useAuth();

    useEffect(() => {
        let navItemsUrl: string[] = [];

        if (roles && roles.length > 0) {
            navItemsUrl = roles.map((role) => ROLE_TO_URL[role]).filter(Boolean);
        }
        
        if (navItemsUrl.length === 0 && metadata?.navItems) {
            navItemsUrl = metadata.navItems.map((item) => item.linkUrl);
        }

        if (loading && navItemsUrl.length === 0) {
            setAuthorized(false);
            return;
        }

        if (navItemsUrl.length === 0) {
            if (error || !loading) {
                router.replace("/login");
            }
            return;
        }

        const allowedPrefixes: string[] = [];
        navItemsUrl.forEach((url) => {
            const prefixes = PREFIX_MAP[url];
            if (prefixes) {
                allowedPrefixes.push(...prefixes);
            } else {
                allowedPrefixes.push(url);
            }
        });

        const hasAccess = allowedPrefixes.some((prefix) =>
            pathname === prefix || pathname.startsWith(prefix + "/")
        );

        if (!hasAccess) {
            const firstUrl = navItemsUrl[0];
            router.replace(URL_MAP[firstUrl] || firstUrl);
        } else {
            setAuthorized(true);
        }
    }, [pathname, router, metadata, loading, error, roles]);

    if (!authorized) {
        return (
            <div className="flex h-screen items-center justify-center bg-canvas">
                <div
                    role="status"
                    aria-label="Checking your access"
                    className="h-8 w-8 animate-spin rounded-full border-2 border-edge border-t-primary"
                ></div>
            </div>
        );
    }

    return <>{children}</>;
}
