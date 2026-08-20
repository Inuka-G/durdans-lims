'use client';

import { Eye, Play } from 'lucide-react';
import { MLTSample } from '@/mock/mlt.mock';
import Button from '@/components/ui/Button';
import PriorityBadge from '@/components/shared/PriorityBadge';
import StatusBadge from '@/components/shared/StatusBadge';

interface MLTWorklistRowProps {
    sample: MLTSample;
    mode: 'worklist' | 'all';
    onAction: (id: string) => void;
}

export default function MLTWorklistRow({ sample, mode, onAction }: MLTWorklistRowProps) {
    const patientMeta = `${sample.patient.pid} · ${sample.patient.age}Y ${sample.patient.gender}`;

    return (
        <tr className="transition-colors hover:bg-surface-hover">
            <td className="py-2 pl-4 pr-3 font-mono text-xs font-medium tabular-nums text-primary-strong">{sample.sampleId}</td>
            <td className="min-w-0 px-3 py-2">
                <p className="truncate font-medium text-fg" title={sample.patient.name}>{sample.patient.name}</p>
                <p className="truncate text-xs text-fg-muted">{patientMeta}</p>
                {sample.patient.wardRoom && (
                    <p className="truncate text-xs text-fg-secondary" title={sample.patient.wardRoom}>{sample.patient.wardRoom}</p>
                )}
            </td>
            <td className="min-w-0 px-3 py-2">
                <p className="truncate text-fg-secondary" title={sample.testType}>{sample.testType}</p>
                <p className="truncate text-xs text-fg-muted">{sample.department}</p>
            </td>
            <td className="px-3 py-2">
                <PriorityBadge priority={sample.priority} />
            </td>
            <td className="px-3 py-2">
                <StatusBadge status={sample.status} />
            </td>
            <td className="py-2 pl-2 pr-3 text-right">
                {mode === 'worklist' ? (
                    <Button
                        size="sm"
                        variant="secondary"
                        icon={Play}
                        onClick={() => onAction(sample.id)}
                        aria-label={`Start ${sample.sampleId}`}
                    >
                        Start
                    </Button>
                ) : (
                    <Button
                        size="sm"
                        variant="secondary"
                        icon={Eye}
                        onClick={() => onAction(sample.id)}
                        aria-label={`View ${sample.sampleId}`}
                    >
                        View
                    </Button>
                )}
            </td>
        </tr>
    );
}
