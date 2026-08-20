'use client';

/**
 * Specimen tube colours are physical (cap colour) so they stay literal in both
 * themes; the ring uses the surface token so dots read on light and dark rows.
 */
const TUBE_COLOR_MAP: Record<string, string> = {
    EDTA:     'bg-purple-500',
    SST:      'bg-yellow-400',
    HEPARIN:  'bg-green-500',
    CITRATE:  'bg-blue-400',
    FLUORIDE: 'bg-gray-400',
    PLAIN:    'bg-red-400',
    URINE:    'bg-yellow-300',
};

const TUBE_LABELS: Record<string, string> = {
    EDTA:     'EDTA (purple)',
    SST:      'SST (gold)',
    HEPARIN:  'Heparin (green)',
    CITRATE:  'Citrate (blue)',
    FLUORIDE: 'Fluoride (grey)',
    PLAIN:    'Plain (red)',
    URINE:    'Urine (yellow)',
};

export default function TubeIndicator({ tubes }: { tubes: string[] }) {
    if (!tubes?.length) return <span className="text-fg-faint">—</span>;
    return (
        <ul className="flex gap-1" aria-label={`Tubes: ${tubes.map((t) => TUBE_LABELS[t] ?? t).join(', ')}`}>
            {tubes.map((t) => (
                <li
                    key={t}
                    className={`h-4 w-4 rounded-full ${TUBE_COLOR_MAP[t] ?? 'bg-fg-faint'} ring-2 ring-surface`}
                    title={TUBE_LABELS[t] ?? t}
                />
            ))}
        </ul>
    );
}
