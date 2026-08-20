"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BadgeCheck, Inbox, LayoutDashboard, RefreshCw } from "lucide-react";
import { listDispatchReports } from "@/lib/api";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";

type LoadState = "loading" | "empty" | "error";

/**
 * /dispatch/authorized-reports has no index of its own: it opens the most
 * recently authorized report. While that lookup runs we show a skeleton; if
 * the queue is empty or the request fails we say so and offer a way out.
 */
export default function AuthorizedReportsRoot() {
    const router = useRouter();
    const [state, setState] = useState<LoadState>("loading");
    const [message, setMessage] = useState("Loading report...");
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let active = true;
        setState("loading");
        setMessage("Loading report...");
        (async () => {
            try {
                const res = await listDispatchReports({ page: 0, size: 1, sort: "authorizedAt,desc" });
                const first = res.content[0];
                if (!active) return;
                if (first?.reportId) {
                    router.replace(`/dispatch/authorized-reports/${encodeURIComponent(first.reportId)}`);
                } else {
                    setState("empty");
                    setMessage("No authorized reports in the queue. Register a report from the lab module or use the API.");
                }
            } catch {
                if (!active) return;
                setState("error");
                setMessage("Could not load reports. Check your connection and permissions.");
            }
        })();
        return () => {
            active = false;
        };
    }, [router, reloadKey]);

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Authorized reports"
                crumbs={[{ label: "Dispatch dashboard", href: "/dispatch/dashboard" }, { label: "Authorized reports" }]}
                meta={
                    <>
                        <BadgeCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Opens the most recently authorized report</span>
                    </>
                }
            />

            {/* Screen-reader status for the redirect lookup */}
            <p role={state === "error" ? "alert" : "status"} aria-live="polite" className="sr-only">
                {message}
            </p>

            <SectionCard title="Latest authorized report" flush>
                {state === "loading" ? (
                    <div aria-busy="true" aria-hidden="true" className="space-y-3 px-4 py-4">
                        <span className="block h-4 w-1/3 rounded bg-skeleton" />
                        <span className="block h-3 w-2/3 rounded bg-skeleton" />
                        <span className="block h-3 w-1/2 rounded bg-skeleton" />
                        <span className="mt-4 block h-24 w-full rounded bg-skeleton" />
                    </div>
                ) : state === "empty" ? (
                    <EmptyState
                        icon={Inbox}
                        title="No authorized reports yet"
                        description={message}
                        action={
                            <Button size="sm" icon={LayoutDashboard} href="/dispatch/dashboard">
                                Open dispatch dashboard
                            </Button>
                        }
                    />
                ) : (
                    <EmptyState
                        icon={AlertTriangle}
                        title="Couldn't load reports"
                        description={message}
                        action={
                            <Button size="sm" icon={RefreshCw} onClick={() => setReloadKey((k) => k + 1)}>
                                Retry
                            </Button>
                        }
                    />
                )}
            </SectionCard>
        </div>
    );
}
