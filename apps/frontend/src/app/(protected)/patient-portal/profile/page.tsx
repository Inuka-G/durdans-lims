"use client";

import { useAuth } from "@/hooks/useAuth";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import { User, Phone, MapPin, Mail, Calendar, Hash } from "lucide-react";
import Button from "@/components/ui/Button";

// Dummy profile data
const DUMMY_PROFILE = {
    firstName: "John",
    lastName: "Doe",
    fullName: "John Doe",
    patientCode: "PT-12345678",
    identityNumber: "851234567V",
    dob: "1985-04-12",
    gender: "MALE",
    bloodGroup: "O+",
    maritalStatus: "MARRIED",
    phone: "0771234567",
    email: "john.doe@example.com",
    address: "123 Main Street\nColombo 03\nSri Lanka",
    emergencyContact: {
        name: "Jane Doe",
        phone: "0777654321",
        relationship: "Spouse"
    }
};

export default function PatientProfilePage() {
    const { user } = useAuth();
    
    // In a real implementation, we would fetch this from the backend
    // using the preferred_username claim from the user session
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patientCode = (user as any)?.preferred_username || DUMMY_PROFILE.patientCode;

    return (
        <div className="mx-auto max-w-[1400px] space-y-6">
            <PageHeader 
                title="My Profile" 
                meta={<span>Manage your personal information and contact details</span>}
                actions={
                    <Button variant="primary" icon={User} className="focus-visible:ring-offset-surface">
                        Edit Profile
                    </Button>
                }
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <SectionCard title="Personal Information">
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                        <div>
                            <dt className="text-xs font-medium text-fg-muted flex items-center gap-1.5 mb-1">
                                <User className="h-3.5 w-3.5" />
                                Full Name
                            </dt>
                            <dd className="text-sm font-medium">{DUMMY_PROFILE.fullName}</dd>
                        </div>
                        
                        <div>
                            <dt className="text-xs font-medium text-fg-muted flex items-center gap-1.5 mb-1">
                                <Hash className="h-3.5 w-3.5" />
                                Patient ID
                            </dt>
                            <dd className="text-sm font-mono">{patientCode}</dd>
                        </div>
                        
                        <div>
                            <dt className="text-xs font-medium text-fg-muted flex items-center gap-1.5 mb-1">
                                <Hash className="h-3.5 w-3.5" />
                                NIC / Passport
                            </dt>
                            <dd className="text-sm">{DUMMY_PROFILE.identityNumber}</dd>
                        </div>
                        
                        <div>
                            <dt className="text-xs font-medium text-fg-muted flex items-center gap-1.5 mb-1">
                                <Calendar className="h-3.5 w-3.5" />
                                Date of Birth
                            </dt>
                            <dd className="text-sm">{DUMMY_PROFILE.dob}</dd>
                        </div>
                        
                        <div>
                            <dt className="text-xs font-medium text-fg-muted mb-1">Gender</dt>
                            <dd className="text-sm">{DUMMY_PROFILE.gender}</dd>
                        </div>
                        
                        <div>
                            <dt className="text-xs font-medium text-fg-muted mb-1">Blood Group</dt>
                            <dd className="text-sm">{DUMMY_PROFILE.bloodGroup}</dd>
                        </div>
                    </dl>
                </SectionCard>

                <SectionCard title="Contact Information">
                    <dl className="grid grid-cols-1 gap-y-4">
                        <div>
                            <dt className="text-xs font-medium text-fg-muted flex items-center gap-1.5 mb-1">
                                <Phone className="h-3.5 w-3.5" />
                                Mobile Number
                            </dt>
                            <dd className="text-sm">{DUMMY_PROFILE.phone}</dd>
                        </div>
                        
                        <div>
                            <dt className="text-xs font-medium text-fg-muted flex items-center gap-1.5 mb-1">
                                <Mail className="h-3.5 w-3.5" />
                                Email Address
                            </dt>
                            <dd className="text-sm">{DUMMY_PROFILE.email}</dd>
                        </div>
                        
                        <div>
                            <dt className="text-xs font-medium text-fg-muted flex items-center gap-1.5 mb-1">
                                <MapPin className="h-3.5 w-3.5" />
                                Residential Address
                            </dt>
                            <dd className="text-sm whitespace-pre-line leading-relaxed">{DUMMY_PROFILE.address}</dd>
                        </div>
                    </dl>
                </SectionCard>

                <SectionCard title="Emergency Contact" className="lg:col-span-2">
                    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-y-4 gap-x-6">
                        <div>
                            <dt className="text-xs font-medium text-fg-muted mb-1">Contact Name</dt>
                            <dd className="text-sm">{DUMMY_PROFILE.emergencyContact.name}</dd>
                        </div>
                        
                        <div>
                            <dt className="text-xs font-medium text-fg-muted mb-1">Relationship</dt>
                            <dd className="text-sm">{DUMMY_PROFILE.emergencyContact.relationship}</dd>
                        </div>
                        
                        <div>
                            <dt className="text-xs font-medium text-fg-muted mb-1">Contact Number</dt>
                            <dd className="text-sm">{DUMMY_PROFILE.emergencyContact.phone}</dd>
                        </div>
                    </dl>
                </SectionCard>
            </div>
        </div>
    );
}
