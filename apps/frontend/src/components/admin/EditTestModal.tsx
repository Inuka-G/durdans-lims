"use client";

import { useEffect, useId, useState } from "react";
import { Info, Save } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import StatusChip from "@/components/ui/StatusChip";
import { FormSection, InputField, SelectField, TextareaField } from "@/components/ui/Field";
import { cn } from "@/lib/utils";

interface EditTestModalProps {
    isOpen: boolean;
    onClose: () => void;
    testData?: {
        code: string;
        name: string;
        category: string;
        price: string;
        isActive: boolean;
    } | null;
}

export default function EditTestModal({ isOpen, onClose, testData }: EditTestModalProps) {
    const formId = useId();
    const activeLabelId = useId();
    const [formData, setFormData] = useState({
        testName: "",
        testCode: "",
        category: "Haematology",
        basePrice: "",
        urgentSurcharge: "25", // mockup value matching screenshot
        referenceRange: "Adult Male: 13.5-17.5 g/dL\nAdult Female: 12.0-15.5 g/dL", // mockup
        measurementUnits: "g/dL", // mockup
        sampleType: "Whole Blood (EDTA)", // mockup
        isActive: true,
    });

    useEffect(() => {
        if (testData) {
            // Strip formatting from price to get numeric value
            const numericPrice = testData.price.replace(/,/g, "").split(".")[0];

            setFormData((prev) => ({
                ...prev,
                testName: testData.name,
                testCode: testData.code,
                category: testData.category,
                basePrice: numericPrice,
                isActive: testData.isActive,
                // Mock specific fields based on exact screenshot if it's the FBC test, otherwise keep defaults
                referenceRange:
                    testData.code === "T-FBC-001" ? "Adult Male: 13.5-17.5 g/dL\nAdult Female: 12.0-15.5 g/dL" : prev.referenceRange,
                measurementUnits: testData.code === "T-FBC-001" ? "g/dL" : prev.measurementUnits,
                sampleType: testData.code === "T-FBC-001" ? "Whole Blood (EDTA)" : prev.sampleType,
            }));
        }
    }, [testData]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Saving test changes:", formData);
        onClose();
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Edit laboratory test"
            description="Update master data for this clinical test"
            size="lg"
            footer={
                <>
                    <p className="mr-auto flex items-center gap-1.5 text-xs text-fg-muted">
                        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Last updated by Admin on 24 Oct 2023 14:12
                    </p>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button type="submit" form={formId} variant="primary" icon={Save}>
                        Save changes
                    </Button>
                </>
            }
        >
            <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Active status */}
                <div className="flex items-center justify-between gap-3 rounded-md border border-edge bg-surface-muted px-3 py-2.5">
                    <div className="min-w-0">
                        <p id={activeLabelId} className="text-sm font-medium text-fg">
                            Active status
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <StatusChip tone={formData.isActive ? "success" : "neutral"} dot size="sm">
                            {formData.isActive ? "Active" : "Inactive"}
                        </StatusChip>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={formData.isActive}
                            aria-labelledby={activeLabelId}
                            onClick={() => setFormData((p) => ({ ...p, isActive: !p.isActive }))}
                            className={cn(
                                "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
                                formData.isActive ? "bg-primary" : "bg-edge-strong"
                            )}
                        >
                            <span
                                aria-hidden="true"
                                className={cn(
                                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-surface ring-1 ring-edge transition-transform",
                                    formData.isActive ? "translate-x-[18px]" : "translate-x-0.5"
                                )}
                            />
                        </button>
                    </div>
                </div>

                {/* Section 1: basic details */}
                <FormSection title="Basic details">
                    <InputField
                        label="Test name"
                        required
                        type="text"
                        className="sm:col-span-2"
                        value={formData.testName}
                        onChange={(e) => setFormData({ ...formData, testName: e.target.value })}
                    />
                    <InputField
                        label="Test code"
                        required
                        type="text"
                        value={formData.testCode}
                        onChange={(e) => setFormData({ ...formData, testCode: e.target.value })}
                    />
                    <SelectField
                        label="Category"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                        <option value="Haematology">Haematology</option>
                        <option value="Biochemistry">Biochemistry</option>
                        <option value="Immunology">Immunology</option>
                        <option value="Microbiology">Microbiology</option>
                    </SelectField>
                </FormSection>

                {/* Section 2: pricing & billing */}
                <FormSection title="Pricing and billing">
                    <InputField
                        label="Base price (LKR)"
                        required
                        type="number"
                        inputMode="decimal"
                        value={formData.basePrice}
                        onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                    />
                    <InputField
                        label="Urgent surcharge (%)"
                        type="number"
                        inputMode="decimal"
                        value={formData.urgentSurcharge}
                        onChange={(e) => setFormData({ ...formData, urgentSurcharge: e.target.value })}
                    />
                </FormSection>

                {/* Section 3: laboratory parameters */}
                <FormSection title="Laboratory parameters">
                    <TextareaField
                        label="Reference range description"
                        rows={3}
                        className="sm:col-span-2"
                        value={formData.referenceRange}
                        onChange={(e) => setFormData({ ...formData, referenceRange: e.target.value })}
                    />
                    <InputField
                        label="Measurement units"
                        type="text"
                        value={formData.measurementUnits}
                        onChange={(e) => setFormData({ ...formData, measurementUnits: e.target.value })}
                    />
                    <SelectField
                        label="Sample type"
                        value={formData.sampleType}
                        onChange={(e) => setFormData({ ...formData, sampleType: e.target.value })}
                    >
                        <option value="Whole Blood (EDTA)">Whole Blood (EDTA)</option>
                        <option value="Serum">Serum</option>
                        <option value="Plasma">Plasma</option>
                        <option value="Urine">Urine</option>
                    </SelectField>
                </FormSection>
            </form>
        </Modal>
    );
}
