"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

function resolvePositionTitle(pathname: string, roles: string[]): string {
    // 1. Contextual Position based on Active Route / Module
    if (pathname.startsWith("/verification")) {
        return "Lab Supervisor";
    }
    if (pathname.startsWith("/clinical")) {
        return "Consultant Pathologist";
    }
    if (pathname.startsWith("/dispatch")) {
        return "Dispatch Officer";
    }
    if (pathname.startsWith("/mlt")) {
        return "Medical Lab Technologist";
    }
    if (pathname.startsWith("/phlebotomy")) {
        return "Phlebotomist";
    }
    if (pathname.startsWith("/reception")) {
        return "Receptionist";
    }
    if (pathname.startsWith("/orders-billing") || pathname.startsWith("/billing")) {
        return "Billing Officer";
    }
    if (pathname.startsWith("/patients")) {
        return "Patient Registrar";
    }
    if (pathname.startsWith("/superadmin")) {
        return "Super Administrator";
    }
    if (pathname.startsWith("/branch")) {
        return "Branch Administrator";
    }
    if (pathname.startsWith("/audit")) {
        return "Quality & Compliance Auditor";
    }

    // 2. Fallback based on User Realm Roles
    if (roles.includes("SUPER_ADMIN")) return "Super Administrator";
    if (roles.includes("BRANCH_ADMIN")) return "Branch Administrator";
    if (roles.includes("PATHOLOGIST")) return "Consultant Pathologist";
    if (roles.includes("LAB_SUPERVISOR")) return "Lab Supervisor";
    if (roles.includes("DISPATCH_OFFICER")) return "Dispatch Officer";
    if (roles.includes("MLT")) return "Medical Lab Technologist";
    if (roles.includes("PHLEBOTOMIST")) return "Phlebotomist";
    if (roles.includes("RECEPTIONIST")) return "Receptionist";
    if (roles.includes("BILLING")) return "Billing Officer";

    return "Medical Staff";
}

export default function AccountStatusBadge() {
    const pathname = usePathname() || "";
    const { roles } = useAuth();
    const position = resolvePositionTitle(pathname, roles);

    return (
        <span className="inline-flex items-center gap-1.5 text-primary font-medium" title={`Position: ${position}`}>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-verified" aria-hidden="true" />
            {position}
        </span>
    );
}
