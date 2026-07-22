/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EmbedJSON, MessageJSON, UserJSON } from "@vencord/discord-types";

interface EmbedFieldJson {
    name: string;
    value: string;
    inline: boolean;
}

interface EmbedJsonFixed extends EmbedJSON {
    fields?: EmbedFieldJson[];
}

interface UserJsonFixed extends UserJSON {
    bot?: boolean;
}

export interface MessageJsonFixed extends Omit<MessageJSON, "author" | "embeds"> {
    author: UserJsonFixed;
    embeds: EmbedJsonFixed[];
}

export interface KeywordEntry {
    enabled: boolean;
    regex: string;
    ignoreCase: boolean;
    ignoreBots: boolean;
    whitelist: string[];
    blacklist: string[];
    listPriority: ListType;
}

export enum ListType {
    BlackList = "BlackList",
    Whitelist = "Whitelist"
}
