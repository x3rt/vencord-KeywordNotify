/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Divider } from "@components/Divider";
import { Span } from "@components/Span";
import { classes } from "@utils/misc";
import type { ReactNode } from "react";

export interface FormGenericLabelProps {
    title: ReactNode;
    description?: ReactNode;

    className?: string;
    disabled?: boolean;
    hideBorder?: boolean;

    children: ReactNode;
}

export function FormGenericLabel({ title, description, disabled, className, hideBorder, children }: FormGenericLabelProps) {
    return (
        <label className="vc-form-switch-wrapper">
            <div className={classes("vc-form-switch", className, disabled && "vc-form-switch-disabled")}>
                <div className={"vc-form-switch-text"}>
                    <Span size="md" weight="medium">{title}</Span>
                    {description && <Span size="sm" weight="normal">{description}</Span>}
                </div>

                {children}
            </div>
            {!hideBorder && <Divider className="vc-form-switch-border" />}
        </label>
    );
}
