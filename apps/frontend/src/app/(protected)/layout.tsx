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

function SidebarForRoute({ pathname }: { pathname: string }) {
    if (pathname.startsWith("/orders-billing")) return <OrdersBillingSidebar />;
    if (pathname.startsWith("/phlebotomy")) return <PhlebotomySidebar />;
    if (pathname.startsWith("/reception")) return <ReceptionSidebar />;
    if (pathname.startsWith("/mlt")) return <MLTSidebar />;
    if (pathname.startsWith("/verification")) return <SeniorMLTSidebar />;
    if (pathname.startsWith("/critical-values")) return <SeniorMLTSidebar />;
    if (pathname.startsWith("/clinical")) return <DoctorSidebar />;
    if (pathname.startsWith("/dispatch")) return <DispatchSidebar />;
    if (pathname.startsWith("/branch")) return <BranchSidebar />;
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
                <div className="bg-[#f8fafc] font-display text-slate-800 min-h-screen">
                    {isSuperAdminAdmin ? <AdministrationNavbar /> : isSuperBranch ? <SuperAdminNavbar /> : isBranch ? <BranchNavbar /> : <TopNav />}

                    <div className="flex pt-[76px] min-h-screen">
                        <SidebarForRoute pathname={pathname} />

                        <main className="flex-1 lg:ml-64 p-8 bg-slate-50/50">
                            {children}
                        </main>
                    </div>
                </div>
                </RoleGuard>
            </MetadataProvider>
        </AuthProvider>
    );
}

