/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classes } from "@utils/misc";
import type { JSX, PropsWithChildren } from "react";

type IconProps = JSX.IntrinsicElements["svg"];

interface BaseIconProps extends IconProps {
    viewBox: string;
}

function Icon({
    height = 24, width = 24, className, children, viewBox, ...svgProps
}: PropsWithChildren<BaseIconProps>) {
    return (
        <svg
            className={classes(className, "vc-icon")}
            role="img"
            width={width}
            height={height}
            viewBox={viewBox}
            {...svgProps}
        >
            {children}
        </svg>
    );
}

// Ideally I would just add this to Icons.tsx, but I cannot as this is a user-plugin :/
export function DoubleCheckmarkIcon(props: IconProps) {
    // noinspection TypeScriptValidateTypes
    return (
        <Icon
            {...props}
            className={classes(props.className, "vc-double-checkmark-icon")}
            viewBox="0 0 24 24"
            width={16}
            height={16}
        >
            <path fill="currentColor"
                d="M16.7 8.7a1 1 0 0 0-1.4-1.4l-3.26 3.24a1 1 0 0 0 1.42 1.42L16.7 8.7ZM3.7 11.3a1 1 0 0 0-1.4 1.4l4.5 4.5a1 1 0 0 0 1.4-1.4l-4.5-4.5Z" />
            <path fill="currentColor"
                d="M21.7 9.7a1 1 0 0 0-1.4-1.4L13 15.58l-3.3-3.3a1 1 0 0 0-1.4 1.42l4 4a1 1 0 0 0 1.4 0l8-8Z" />
        </Icon>
    );
}

