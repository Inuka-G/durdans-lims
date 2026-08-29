"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getPatientById, updatePatient, Patient } from "@/lib/api";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import { User, Phone, MapPin, Mail, Calendar, Hash, AlertCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { InputField, TextareaField } from "@/components/ui/Field";

export default function PatientProfilePage() {
    const { user } = useAuth();
    const [patient, setPatient] = useState<Patient | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Form state for editing
    const [editData, setEditData] = useState<Partial<Patient>>({});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patientCode = (user as any)?.preferred_username;

    useEffect(() => {
        if (!patientCode) {
            setError("Could not identify patient from session.");
            setLoading(false);
            return;
        }

        getPatientById(patientCode)
            .then((data) => setPatient(data))
            .catch((err) => {
                console.error(err);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if ((err as any).response?.status === 404) {
                    // Fallback to dummy data for testing purposes if the user doesn't exist in DB
                    setPatient({
                        id: "dummy-123",
                        patientCode: patientCode,
                        firstName: "Test",
                        lastName: "User",
                        fullName: "Test User",
                        dateOfBirth: "1990-01-01",
                        gender: "MALE",
                        bloodGroup: "O+",
                        phone: "0771234567",
                        email: "test@example.com",
                        address: "123 Main Street\nColombo",
                        identityNumber: "123456789V",
                        emergencyContactName: "Emergency Contact",
                        emergencyContactRelation: "Family",
                        emergencyContactPhone: "0777654321",
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        createdBy: "system",
                        updatedBy: "system"
                    });
                } else {
                    setError("Failed to load your profile. Please try again later.");
                }
            })
            .finally(() => setLoading(false));
    }, [patientCode]);

    const handleEditClick = () => {
        if (patient) {
            setEditData({
                phone: patient.phone || patient.phoneNumber || "",
                email: patient.email || "",
                address: patient.address || "",
                emergencyContactName: patient.emergencyContactName || "",
                emergencyContactRelation: patient.emergencyContactRelation || "",
                emergencyContactPhone: patient.emergencyContactPhone || ""
            });
            setIsEditModalOpen(true);
        }
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patientCode) return;
        
        setIsSaving(true);
        try {
            await updatePatient(patientCode, editData);
            
            // Update local state
            setPatient(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    ...editData,
                };
            });
            setIsEditModalOpen(false);
        } catch (err) {
            console.error("Failed to update profile", err);
            alert("Failed to update profile. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-32 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-edge border-t-primary"></div>
            </div>
        );
    }

    if (error || !patient) {
        return (
            <div className="mx-auto max-w-[1400px] space-y-6">
                <PageHeader title="My Profile" meta={<span>Manage your personal information and contact details</span>} />
                <div className="rounded-lg border border-status-danger-edge bg-status-danger-bg p-4 text-status-danger-fg">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        <span className="font-medium">{error || "Failed to load profile"}</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-[1400px] space-y-6">
            <PageHeader 
                title="My Profile" 
                meta={<span>Manage your personal information and contact details</span>}
                actions={
                    <Button variant="primary" icon={User} onClick={handleEditClick} className="focus-visible:ring-offset-surface">
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
                            <dd className="text-sm font-medium">{patient.fullName || `${patient.firstName || ''} ${patient.lastName || ''}`.trim()}</dd>
                        </div>
                        
                        <div>
                            <dt className="text-xs font-medium text-fg-muted flex items-center gap-1.5 mb-1">
                                <Hash className="h-3.5 w-3.5" />
                                Patient ID
                            </dt>
                            <dd className="text-sm font-mono">{patient.patientCode || patientCode}</dd>
                        </div>
                        
                        <div>
                            <dt className="text-xs font-medium text-fg-muted flex items-center gap-1.5 mb-1">
                                <Hash className="h-3.5 w-3.5" />
                                NIC / Passport
                            </dt>
                            <dd className="text-sm">{patient.identityNumber || "N/A"}</dd>
                        </div>
                        
                        <div>
                            <dt className="text-xs font-medium text-fg-muted flex items-center gap-1.5 mb-1">
                                <Calendar className="h-3.5 w-3.5" />
                                Date of Birth
                            </dt>
                            <dd className="text-sm">{patient.dateOfBirth || "N/A"}</dd>
                        </div>
                        
                        <div>
                            <dt className="text-xs font-medium text-fg-muted mb-1">Gender</dt>
                            <dd className="text-sm">{patient.gender || "N/A"}</dd>
                        </div>
                        
                        <div>
                            <dt className="text-xs font-medium text-fg-muted mb-1">Blood Group</dt>
                            <dd className="text-sm">{patient.bloodGroup || "N/A"}</dd>
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
                            <dd className="text-sm">{patient.phone || patient.phoneNumber || "N/A"}</dd>
                        </div>
                        
                        <div>
                            <dt className="text-xs font-medium text-fg-muted flex items-center gap-1.5 mb-1">
                                <Mail className="h-3.5 w-3.5" />
                                Email Address
                            </dt>
                            <dd className="text-sm">{patient.email || "N/A"}</dd>
                        </div>
                        
                        <div>
                            <dt className="text-xs font-medium text-fg-muted flex items-center gap-1.5 mb-1">
                                <MapPin className="h-3.5 w-3.5" />
                                Residential Address
                            </dt>
                            <dd className="text-sm whitespace-pre-line leading-relaxed">{patient.address || "N/A"}</dd>
                        </div>
                    </dl>
                </SectionCard>

                {(patient.emergencyContactName || patient.emergencyContactPhone) && (
                    <SectionCard title="Emergency Contact" className="lg:col-span-2">
                        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-y-4 gap-x-6">
                            <div>
                                <dt className="text-xs font-medium text-fg-muted mb-1">Contact Name</dt>
                                <dd className="text-sm">{patient.emergencyContactName || "N/A"}</dd>
                            </div>
                            
                            <div>
                                <dt className="text-xs font-medium text-fg-muted mb-1">Relationship</dt>
                                <dd className="text-sm">{patient.emergencyContactRelation || "N/A"}</dd>
                            </div>
                            
                            <div>
                                <dt className="text-xs font-medium text-fg-muted mb-1">Contact Number</dt>
                                <dd className="text-sm">{patient.emergencyContactPhone || "N/A"}</dd>
                            </div>
                        </dl>
                    </SectionCard>
                )}
            </div>

            {/* Edit Profile Modal */}
            <Modal 
                open={isEditModalOpen} 
                onClose={() => !isSaving && setIsEditModalOpen(false)} 
                title="Edit Profile"
                size="md"
                dismissible={!isSaving}
                footer={
                    <>
                        <Button 
                            variant="secondary" 
                            onClick={() => setIsEditModalOpen(false)}
                            disabled={isSaving}
                        >
                            Cancel
                        </Button>
                        <Button 
                            variant="primary" 
                            onClick={handleSaveProfile}
                            loading={isSaving}
                            disabled={isSaving}
                        >
                            Save Changes
                        </Button>
                    </>
                }
            >
                <form id="edit-profile-form" onSubmit={handleSaveProfile} className="space-y-4 py-2">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <InputField 
                            id="edit-phone"
                            label="Mobile Number" 
                            value={editData.phone || ""}
                            onChange={(e) => setEditData({...editData, phone: e.target.value})}
                            disabled={isSaving}
                        />
                        <InputField 
                            id="edit-email"
                            label="Email Address" 
                            type="email"
                            value={editData.email || ""}
                            onChange={(e) => setEditData({...editData, email: e.target.value})}
                            disabled={isSaving}
                        />
                    </div>
                    
                    <TextareaField 
                        id="edit-address"
                        label="Residential Address" 
                        value={editData.address || ""}
                        onChange={(e) => setEditData({...editData, address: e.target.value})}
                        disabled={isSaving}
                        rows={3}
                    />

                    <div className="pt-2">
                        <h4 className="text-sm font-medium mb-3 text-fg">Emergency Contact</h4>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <InputField 
                                id="edit-em-name"
                                label="Contact Name" 
                                value={editData.emergencyContactName || ""}
                                onChange={(e) => setEditData({...editData, emergencyContactName: e.target.value})}
                                disabled={isSaving}
                            />
                            <InputField 
                                id="edit-em-phone"
                                label="Contact Number" 
                                value={editData.emergencyContactPhone || ""}
                                onChange={(e) => setEditData({...editData, emergencyContactPhone: e.target.value})}
                                disabled={isSaving}
                            />
                            <div className="sm:col-span-2">
                                <InputField 
                                    id="edit-em-rel"
                                    label="Relationship" 
                                    value={editData.emergencyContactRelation || ""}
                                    onChange={(e) => setEditData({...editData, emergencyContactRelation: e.target.value})}
                                    disabled={isSaving}
                                />
                            </div>
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
