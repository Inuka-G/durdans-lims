'use client';

import { Ban, CheckCircle2 } from 'lucide-react';
import { ReceptionSample } from '@/mock/reception.mock';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/shared/StatusBadge';

interface AccessioningRowProps {
    sample: ReceptionSample;
    onVerify: (id: string) => void;
    onReject: (id: string) => void;
}

export default function AccessioningRow({ sample, onVerify, onReject }: AccessioningRowProps) {
    return (
        <tr className="border-b border-edge transition-colors last:border-0 hover:bg-surface-hover">
            <td className="py-2 pl-4 pr-3 font-mono text-xs font-semibold text-primary-strong">{sample.sampleId}</td>
            <td className="px-3 py-2">
                <p className="truncate font-medium text-fg">{sample.patient.name}</p>
                <p className="truncate text-xs text-fg-muted">
                    {sample.patient.pid} · {sample.patient.age}Y {sample.patient.gender}
                </p>
                {sample.patient.wardRoom && <p className="mt-0.5 truncate text-xs text-primary-strong">{sample.patient.wardRoom}</p>}
            </td>
            <td className="truncate px-3 py-2 text-fg-secondary">{sample.testType}</td>
            <td className="px-3 py-2 tabular-nums text-fg-muted">{sample.collectionTime}</td>
            <td className="px-3 py-2">
                <StatusBadge status={sample.status} />
            </td>
            <td className="py-2 pl-2 pr-3 text-right">
                <div className="flex justify-end gap-1.5">
                    <Button variant="primary" size="sm" icon={CheckCircle2} onClick={() => onVerify(sample.id)}>
                        Verify
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        icon={Ban}
                        onClick={() => onReject(sample.id)}
                        className="text-status-danger-fg hover:bg-status-danger-bg hover:text-status-danger-fg"
                    >
                        Reject
                    </Button>
                </div>
            </td>
        </tr>
    );
}
