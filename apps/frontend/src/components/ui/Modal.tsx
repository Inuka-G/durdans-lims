"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Modal — accessible dialog for forms and confirmations.
 * - role="dialog" + aria-modal, labelled by the title
 * - Esc closes, backdrop click closes (unless `dismissible={false}`)
 * - focus moves into the dialog on open and returns to the opener on close
 * - Tab is trapped inside
 * - body scroll locked while open
 *
 *   <Modal open={open} onClose={close} title="Reject sample" size="md"
 *          footer={<><Button onClick={close}>Cancel</Button><Button variant="danger">Reject</Button></>}>
 *     …fields…
 *   </Modal>
 */
export type ModalSize = "sm" | "md" | "lg" | "xl";

const SIZE: Record<ModalSize, string> = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
};

const FOCUSABLE =
    'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function Modal({
    open,
    onClose,
    title,
    description,
    children,
    footer,
    size = "md",
    dismissible = true,
    className,
}: {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    description?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    size?: ModalSize;
    /** false = no Esc / backdrop close (e.g. while submitting). */
    dismissible?: boolean;
    className?: string;
}) {
    const titleId = useId();
    const descId = useId();
    const panelRef = useRef<HTMLDivElement | null>(null);
    const openerRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!open) return;
        openerRef.current = (document.activeElement as HTMLElement | null) ?? null;
        const panel = panelRef.current;
        const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
        (first ?? panel)?.focus();

        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && dismissible) {
                e.preventDefault();
                onClose();
                return;
            }
            if (e.key === "Tab" && panel) {
                const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
                if (nodes.length === 0) {
                    e.preventDefault();
                    return;
                }
                const firstEl = nodes[0];
                const lastEl = nodes[nodes.length - 1];
                if (e.shiftKey && document.activeElement === firstEl) {
                    e.preventDefault();
                    lastEl.focus();
                } else if (!e.shiftKey && document.activeElement === lastEl) {
                    e.preventDefault();
                    firstEl.focus();
                }
            }
        };
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prevOverflow;
            openerRef.current?.focus?.();
        };
    }, [open, dismissible, onClose]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 backdrop-blur-[1px] sm:items-center sm:p-4"
            onMouseDown={(e) => {
                if (dismissible && e.target === e.currentTarget) onClose();
            }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={description ? descId : undefined}
                tabIndex={-1}
                className={cn(
                    "flex max-h-[92vh] w-full flex-col rounded-t-xl border border-edge bg-surface shadow-2xl shadow-black/20 outline-none sm:rounded-lg",
                    SIZE[size],
                    className
                )}
            >
                <header className="flex items-start gap-3 border-b border-edge px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                        <h2 id={titleId} className="text-base font-semibold text-fg">
                            {title}
                        </h2>
                        {description && (
                            <p id={descId} className="mt-0.5 text-xs text-fg-muted">
                                {description}
                            </p>
                        )}
                    </div>
                    {dismissible && (
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close dialog"
                            className="-mr-1.5 -mt-1 rounded p-1.5 text-fg-faint transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                            <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                    )}
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
                {footer && (
                    <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-edge bg-surface-muted px-5 py-3 sm:rounded-b-lg">
                        {footer}
                    </footer>
                )}
            </div>
        </div>
    );
}
