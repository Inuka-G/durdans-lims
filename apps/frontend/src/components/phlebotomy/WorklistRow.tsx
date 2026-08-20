'use client';

import { Ban, Play } from 'lucide-react';
import { PhlebSample } from '@/mock/phlebotomy.mock';
import Button from '@/components/ui/Button';
import StatusChip from '@/components/ui/StatusChip';
import PriorityBadge from '@/components/shared/PriorityBadge';
import TubeIndicator from '@/components/shared/TubeIndicator';

interface WorklistRowProps {
    sample: PhlebSample;
    onStartCollection: (id: string) => void;
    onReject: (id: string) => void;
}

export default function WorklistRow({ sample, onStartCollection, onReject }: WorklistRowProps) {
    const waitColor =
        sample.waitTimeMinutes > 30 ? 'text-status-danger-fg' :
        sample.waitTimeMinutes > 15 ? 'text-status-pending-fg' :
        'text-fg-secondary';
    const waitNote =
        sample.waitTimeMinutes > 30 ? 'Waiting over 30 minutes' :
        sample.waitTimeMinutes > 15 ? 'Waiting over 15 minutes' :
        undefined;

    return (
        <tr className="border-b border-edge transition-colors last:border-0 hover:bg-surface-hover">
            <td className="py-2 pl-4 pr-3">
                <p className="truncate font-medium text-fg">{sample.patient.name}</p>
                <p className="truncate text-xs text-fg-muted">
                    {sample.patient.pid} · {sample.patient.age}Y {sample.patient.gender}
                </p>
                {sample.patient.wardRoom && <p className="mt-0.5 truncate text-xs text-primary-strong">{sample.patient.wardRoom}</p>}
            </td>
            <td className="px-3 py-2">
                <PriorityBadge priority={sample.priority} />
            </td>
            <td className="px-3 py-2">
                <p className="truncate font-medium text-fg-secondary">{sample.testType}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                    {sample.testCodes.map((c) => (
                        <StatusChip key={c} tone="neutral" size="sm">
                            {c}
                        </StatusChip>
                    ))}
                </div>
            </td>
            <td className="px-3 py-2">
                <TubeIndicator tubes={sample.tubeTypes} />
            </td>
            <td className="px-3 py-2">
                <span className={`font-semibold tabular-nums ${waitColor}`} title={waitNote}>
                    {sample.waitTimeMinutes} min
                    {waitNote && <span className="sr-only"> — {waitNote}</span>}
                </span>
            </td>
            <td className="py-2 pl-2 pr-3 text-right">
                <div className="flex justify-end gap-1.5">
                    <Button variant="primary" size="sm" icon={Play} onClick={() => onStartCollection(sample.id)}>
                        Collect
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
