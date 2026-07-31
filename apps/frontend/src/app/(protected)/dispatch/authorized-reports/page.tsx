"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listDispatchReports } from "@/lib/api";

export default function AuthorizedReportsRoot() {
    const router = useRouter();
    const [message, setMessage] = useState("Loading report...");

    useEffect(() => {
        (async () => {
            try {
                const res = await listDispatchReports({ page: 0, size: 1, sort: "authorizedAt,desc" });
                const first = res.content[0];
                if (first?.reportId) {
                    router.replace(`/dispatch/authorized-reports/${encodeURIComponent(first.reportId)}`);
                } else {
                    setMessage("No authorized reports in the queue. Register a report from the lab module or use the API.");
                }
            } catch {
                setMessage("Could not load reports. Check your connection and permissions.");
            }
        })();
    }, [router]);

    return (
        <div className="flex items-center justify-center h-full text-[13px] text-slate-400">
            {message}
        </div>
    );
}
