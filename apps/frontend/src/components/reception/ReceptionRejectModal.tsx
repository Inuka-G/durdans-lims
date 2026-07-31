'use client';

import { useState } from 'react';
import { toast } from 'sonner';

interface ReceptionRejectModalProps {
    sampleId: string;
    patientName: string;
    onConfirm: (sampleId: string, reason: string, comment: string) => void;
    onClose: () => void;
}

const REJECTION_REASONS = [
    'Haemolysed specimen',
    'Clotted sample',
    'Incorrect tube type used',
    'Insufficient volume',
    'Unlabelled / mislabelled tube',
    'Leaked / contaminated sample',
    'Delayed delivery (> 2 hours)',
    'Temperature excursion',
    'Missing requisition form',
    'Other',
];

export default function ReceptionRejectModal({ sampleId, patientName, onConfirm, onClose }: ReceptionRejectModalProps) {
    const [reason, setReason] = useState('');
    const [comment, setComment] = useState('');

    const handleConfirm = () => {
        if (!reason) {
            toast.error('Please select a rejection reason');
            return;
        }
        onConfirm(sampleId, reason, comment);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md mx-4 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <span className="material-icons text-red-500">block</span>
                        <h2 className="text-base font-bold text-slate-800">Reject Sample — Lab Reception</h2>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                        <span className="material-icons text-lg">close</span>
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                        <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Sample being rejected</p>
                        <p className="text-sm font-semibold text-slate-800">{patientName}</p>
                        <p className="text-xs text-slate-500 font-mono">{sampleId}</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                            Rejection Reason <span className="text-red-500">*</span>
                        </label>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {REJECTION_REASONS.map((r) => (
                                <label key={r} className="flex items-center gap-3 cursor-pointer group">
                                    <input
                                        type="radio"
                                        name="reception-reason"
                                        value={r}
                                        checked={reason === r}
                                        onChange={() => setReason(r)}
                                        className="accent-primary"
                                    />
                                    <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">{r}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                            Additional Notes (optional)
                        </label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={2}
                            placeholder="Add any notes for the phlebotomist..."
                            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 resize-none transition-all"
                        />
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors"
                    >
                        <span className="material-icons text-sm mr-1 align-middle">block</span>
                        Confirm Rejection
                    </button>
                </div>
            </div>
        </div>
    );
}
