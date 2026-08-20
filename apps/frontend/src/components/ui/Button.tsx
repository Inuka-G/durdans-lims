"use client";

import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Button — the one button for the patient module.
 *
 *   primary    one per view (the main action)        solid brand
 *   secondary  default                              bordered surface
 *   ghost      toolbars / tables                    no border
 *   danger     destructive confirm                  solid red
 *
 * Sizes: sm (28px) for toolbars and table rows, md (36px) default.
 * `href` renders a Next <Link> with identical styling.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const VARIANT: Record<ButtonVariant, string> = {
    primary: "bg-primary-strong text-white hover:bg-primary dark:text-slate-950 dark:hover:bg-primary-strong/90",
    secondary: "border border-edge bg-surface text-fg-secondary hover:bg-surface-hover hover:text-fg",
    ghost: "text-fg-secondary hover:bg-surface-hover hover:text-fg",
    danger: "bg-status-danger text-white hover:bg-red-600",
};

const SIZE: Record<ButtonSize, string> = {
    sm: "h-7 gap-1.5 px-2.5 text-xs [&>svg]:h-3.5 [&>svg]:w-3.5",
    md: "h-9 gap-1.5 px-3.5 text-sm [&>svg]:h-4 [&>svg]:w-4",
};

const BASE =
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-canvas " +
    "disabled:pointer-events-none disabled:opacity-50";

type CommonProps = {
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: LucideIcon;
    /** Shows a spinner and disables the control. */
    loading?: boolean;
    children?: ReactNode;
    className?: string;
};

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
export type ButtonLinkProps = CommonProps & { href: string; target?: string; rel?: string; "aria-label"?: string };

export function buttonClassName({
    variant = "secondary",
    size = "md",
    className,
}: Pick<CommonProps, "variant" | "size" | "className">) {
    return cn(BASE, VARIANT[variant], SIZE[size], className);
}

const Button = forwardRef<HTMLButtonElement, ButtonProps | ButtonLinkProps>(function Button(props, ref) {
    const { variant = "secondary", size = "md", icon: Icon, loading, children, className, ...rest } = props as ButtonProps;
    const classes = buttonClassName({ variant, size, className });
    const content = (
        <>
            {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : Icon ? <Icon aria-hidden="true" /> : null}
            {children}
        </>
    );

    if ("href" in props && props.href) {
        const { href, target, rel, "aria-label": ariaLabel } = props as ButtonLinkProps;
        return (
            <Link href={href} target={target} rel={rel} aria-label={ariaLabel} className={classes}>
                {content}
            </Link>
        );
    }

    const { type = "button", disabled, ...buttonRest } = rest as ButtonHTMLAttributes<HTMLButtonElement>;
    return (
        <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={classes} {...buttonRest}>
            {content}
        </button>
    );
});

export default Button;
