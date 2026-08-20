"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Form field primitives. Label above, control, then hint OR error below.
 * All controls share one 36px height, one border token and one focus ring so a
 * form reads as a single system in light and dark.
 */

export const CONTROL_CLASS =
    "block w-full rounded-md border border-edge bg-surface px-3 text-sm text-fg placeholder:text-fg-faint " +
    "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 " +
    "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-fg-muted " +
    "aria-[invalid=true]:border-status-danger aria-[invalid=true]:focus:ring-status-danger/30";

type FieldShellProps = {
    label: ReactNode;
    hint?: ReactNode;
    error?: ReactNode;
    required?: boolean;
    className?: string;
    /** Visually hides the label (still read by screen readers). */
    hideLabel?: boolean;
};

function Shell({
    id,
    label,
    hint,
    error,
    required,
    className,
    hideLabel,
    children,
}: FieldShellProps & { id: string; children: ReactNode }) {
    return (
        <div className={cn("min-w-0", className)}>
            <label htmlFor={id} className={cn("mb-1 block text-xs font-medium text-fg-secondary", hideLabel && "sr-only")}>
                {label}
                {required && (
                    <span className="ml-0.5 text-status-danger-fg" aria-hidden="true">
                        *
                    </span>
                )}
            </label>
            {children}
            {error ? (
                <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-status-danger-fg">
                    {error}
                </p>
            ) : hint ? (
                <p id={`${id}-hint`} className="mt-1 text-xs text-fg-muted">
                    {hint}
                </p>
            ) : null}
        </div>
    );
}

function describedBy(id: string, hint?: ReactNode, error?: ReactNode) {
    if (error) return `${id}-error`;
    if (hint) return `${id}-hint`;
    return undefined;
}

export type InputFieldProps = FieldShellProps & Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id"> & { id?: string };

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField(
    { label, hint, error, required, className, hideLabel, id: idProp, ...input },
    ref
) {
    const auto = useId();
    const id = idProp ?? auto;
    return (
        <Shell id={id} label={label} hint={hint} error={error} required={required} className={className} hideLabel={hideLabel}>
            <input
                ref={ref}
                id={id}
                required={required}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy(id, hint, error)}
                className={cn(CONTROL_CLASS, "h-9")}
                {...input}
            />
        </Shell>
    );
});

export type SelectFieldProps = FieldShellProps &
    Omit<SelectHTMLAttributes<HTMLSelectElement>, "className" | "id"> & { id?: string; children: ReactNode };

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
    { label, hint, error, required, className, hideLabel, id: idProp, children, ...select },
    ref
) {
    const auto = useId();
    const id = idProp ?? auto;
    return (
        <Shell id={id} label={label} hint={hint} error={error} required={required} className={className} hideLabel={hideLabel}>
            <select
                ref={ref}
                id={id}
                required={required}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy(id, hint, error)}
                className={cn(CONTROL_CLASS, "h-9 pr-8")}
                {...select}
            >
                {children}
            </select>
        </Shell>
    );
});

export type TextareaFieldProps = FieldShellProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className" | "id"> & { id?: string };

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(function TextareaField(
    { label, hint, error, required, className, hideLabel, id: idProp, rows = 3, ...textarea },
    ref
) {
    const auto = useId();
    const id = idProp ?? auto;
    return (
        <Shell id={id} label={label} hint={hint} error={error} required={required} className={className} hideLabel={hideLabel}>
            <textarea
                ref={ref}
                id={id}
                rows={rows}
                required={required}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy(id, hint, error)}
                className={cn(CONTROL_CLASS, "py-2")}
                {...textarea}
            />
        </Shell>
    );
});

/** Group fields into a titled section of a form (one card per section). */
export function FormSection({
    title,
    description,
    children,
    className,
}: {
    title: string;
    description?: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <fieldset className={cn("rounded-lg border border-edge bg-surface p-4 sm:p-5", className)}>
            <legend className="sr-only">{title}</legend>
            <div className="mb-4">
                <h2 className="text-sm font-semibold text-fg">{title}</h2>
                {description && <p className="mt-0.5 text-xs text-fg-muted">{description}</p>}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
        </fieldset>
    );
}
