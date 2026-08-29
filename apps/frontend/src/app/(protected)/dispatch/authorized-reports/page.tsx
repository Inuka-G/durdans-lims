"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /dispatch/authorized-reports redirects to the main worklist (/dispatch/dashboard)
 * where the user selects a report to review and dispatch.
 */
export default function AuthorizedReportsRoot() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/dispatch/dashboard");
    }, [router]);

    return null;
}
