'use client';

import { useState } from 'react';
import { Ban } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { SelectField, TextareaField } from '@/components/ui/Field';

interface RejectSampleModalProps {
    sampleId: string;
    patientName: string;
    onConfirm: (sampleId: string, reason: string, comment: string) => void;
    onClose: () => void;
}

const REJECTION_REASONS = [
    'Haemolysed specimen',
    'Clotted sample',
    'Insufficient volume',
    'Wrong tube type',
    'Unlabelled/mislabelled tube',
    'Leaked / contaminated',
    'Delayed transport (>2h)',
    'Other',
];

export default function RejectSampleModal({ sampleId, patientName, onConfirm, onClose }: RejectSampleModalProps) {
    const [reason, setReason] = useState('');
    const [comment, setComment] = useState('');
    const [reasonError, setReasonError] = useState<string | null>(null);

    const handleConfirm = () => {
        if (!reason) {
            setReasonError('Select a rejection reason');
            toast.error('Please select a rejection reason');
            return;
        }
        onConfirm(sampleId, reason, comment);
        onClose();
    };

    return (
        <Modal
            open
            onClose={onClose}
            title="Reject sample"
            description="Record why this sample cannot be collected or accepted."
            size="md"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="danger" icon={Ban} onClick={handleConfirm}>
                        Reject sample
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="rounded-md border border-status-danger-edge bg-status-danger-bg px-3 py-2.5">
                    <p className="text-xs font-medium text-status-danger-fg">Sample to reject</p>
                    <p className="mt-0.5 text-sm font-semibold text-fg">{patientName}</p>
                    <p className="font-mono text-xs text-fg-muted">{sampleId}</p>
                </div>

                <SelectField
                    label="Rejection reason"
                    required
                    value={reason}
                    error={reasonError}
                    onChange={(e) => {
                        setReason(e.target.value);
                        if (e.target.value) setReasonError(null);
                    }}
                >
                    <option value="">Select a reason</option>
                    {REJECTION_REASONS.map((r) => (
                        <option key={r} value={r}>
                            {r}
                        </option>
                    ))}
                </SelectField>

                <TextareaField
                    label="Additional comment"
                    hint="Optional"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    placeholder="Add any notes"
                />
            </div>
        </Modal>
    );
}
