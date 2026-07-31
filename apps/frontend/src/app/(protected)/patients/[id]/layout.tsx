"use client";
import { PatientProvider } from "./PatientProvider";
import { use } from "react";
import Link from "next/link";

export default function PatientRootLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const resolvedParams = use(params);

    return (
        <PatientProvider id={resolvedParams.id}>
            <div className="max-w-6xl mx-auto">
                <nav className="flex text-xs font-medium text-slate-400 mb-4 md:mb-6 gap-2 items-center flex-wrap">
                    <Link className="hover:text-primary" href="/patients">Patient Management</Link>
                    <span className="material-icons text-[10px]">chevron_right</span>
                    <Link className="hover:text-primary" href={`/patients/${resolvedParams.id}`}>Patient Profiles</Link>
                    <span className="material-icons text-[10px]">chevron_right</span>
                    <span className="text-slate-600">{resolvedParams.id}</span>
                </nav>
                {children}
            </div>
        </PatientProvider>
    );
}
