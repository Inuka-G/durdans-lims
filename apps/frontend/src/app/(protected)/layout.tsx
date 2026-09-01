"use client";

import AuthProvider from "@/providers/AuthProvider";
import { MetadataProvider } from "@/providers/MetadataProvider";
import RoleGuard from "@/providers/RoleGuard";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import OrdersBillingSidebar from "@/components/layout/OrdersBillingSidebar";
import PhlebotomySidebar from "@/components/layout/PhlebotomySidebar";
import ReceptionSidebar from "@/components/layout/ReceptionSidebar";
import MLTSidebar from "@/components/layout/MLTSidebar";
import SeniorMLTSidebar from "@/components/layout/SeniorMLTSidebar";
import DoctorSidebar from "@/components/layout/DoctorSidebar";
import DispatchSidebar from "@/components/layout/DispatchSidebar";
import TopNav from "@/components/layout/TopNav";
import BranchSidebar from "@/components/layout/BranchSidebar";
import SuperBranchSidebar from "@/components/layout/SuperAdminSidebar";
import SuperAdminNavbar from "@/components/layout/SuperAdminNavbar";
import AdministrationSidebar from "@/components/layout/AdministrationSidebar";
import AdministrationNavbar from "@/components/layout/AdministrationNavbar";
import BranchNavbar from "@/components/layout/BranchNavbar";

import PatientSidebar from "@/components/layout/PatientSidebar";

function SidebarForRoute({ pathname }: { pathname: string }) {
    if (pathname.startsWith("/orders-billing")) return <OrdersBillingSidebar />;
    if (pathname.startsWith("/phlebotomy")) return <PhlebotomySidebar />;
    if (pathname.startsWith("/reception")) return <ReceptionSidebar />;
    if (pathname.startsWith("/mlt")) return <MLTSidebar />;
    if (pathname.startsWith("/verification")) return <SeniorMLTSidebar />;
    if (pathname.startsWith("/clinical")) return <DoctorSidebar />;
    if (pathname.startsWith("/dispatch")) return <DispatchSidebar />;
    if (pathname.startsWith("/branch")) return <BranchSidebar />;
    if (pathname.startsWith("/patient-portal")) return <PatientSidebar />;
    if (pathname.startsWith("/superadmin/roles") || pathname.includes("/admin/")) return <AdministrationSidebar />;
    if (pathname.startsWith("/superadmin")) return <SuperBranchSidebar />;
    return <Sidebar />;
}

export default function ProtectedLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const isSuperAdminAdmin = pathname.startsWith("/superadmin/roles") || pathname.includes("/admin/");
    const isSuperBranch = pathname.startsWith("/superadmin") && !isSuperAdminAdmin;
    const isBranch = pathname.startsWith("/branch");

    return (
        <AuthProvider>
            <MetadataProvider>
                <RoleGuard>
                <div className="min-h-screen bg-canvas font-display text-fg">
                    {isSuperAdminAdmin ? <AdministrationNavbar /> : isSuperBranch ? <SuperAdminNavbar /> : isBranch ? <BranchNavbar /> : <TopNav />}

                    {/* pt matches the fixed top bar's h-16, the same offset the sidebars use (top-16). */}
                    <div className="flex min-h-screen pt-16">
                        <SidebarForRoute pathname={pathname} />

                        <main className="min-w-0 flex-1 bg-canvas p-4 sm:p-6 lg:ml-64 lg:p-8">
                            {children}
                        </main>
                    </div>
                </div>
                </RoleGuard>
            </MetadataProvider>
        </AuthProvider>
    );
}
