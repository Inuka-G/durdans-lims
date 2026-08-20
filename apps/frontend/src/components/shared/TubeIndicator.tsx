'use client';

/**
 * Tube dots are driven by the supplies inventory: `color` is the stocked
 * container's cap colour. That is a physical property of a real object, so it
 * stays a literal value in both themes (DESIGN.md lists specimen tube cap
 * colours as an allowed exception to the token rule).
 *
 * Grey is *not* a tube colour — it flags a tube type with no stocked container
 * to read a colour from. Because that grey is a UI state rather than a physical
 * cap, it uses the `fg-faint` token and follows the theme. The ring uses the
 * surface token so dots read on light and dark rows alike.
 */

export interface TubeIndicatorTube {
    code: string;
    color?: string | null;
    label?: string;
}

interface TubeIndicatorProps {
    tubes: TubeIndicatorTube[];
}

/** Tube codes arrive as `WHOLE_BLOOD`; the inventory label wins when it has one. */
function tubeLabel(tube: TubeIndicatorTube) {
    return tube.label ?? tube.code.replace(/_/g, ' ');
}

export default function TubeIndicator({ tubes }: TubeIndicatorProps) {
    if (!tubes?.length) return <span className="text-fg-faint">—</span>;

    return (
        <ul className="flex gap-1" aria-label={`Tubes: ${tubes.map(tubeLabel).join(', ')}`}>
            {tubes.map((tube) => {
                const capColor = tube.color?.trim();
                return (
                    <li
                        key={tube.code}
                        className={`h-4 w-4 rounded-full ring-2 ring-surface ${capColor ? '' : 'bg-fg-faint'}`}
                        style={capColor ? { backgroundColor: capColor } : undefined}
                        title={tubeLabel(tube)}
                    />
                );
            })}
        </ul>
    );
}
