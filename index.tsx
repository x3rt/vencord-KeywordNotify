/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated, camila314, and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { DataStore } from "@api/index";
import { plugins } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { openPluginModal } from "@components/settings/tabs/plugins/PluginModal";
import { classNameFactory } from "@utils/css";
import { classes } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { Message, ScrollerBaseRef } from "@vencord/discord-types";
import { findByCodeLazy, findCssClassesLazy } from "@webpack";
import {
    ChannelStore,
    FluxDispatcher,
    ScrollerThin,
    TabBar,
    Tooltip,
    useRef,
    UserStore,
    useState
} from "@webpack/common";
import type { JSX, RefObject } from "react";

import { DoubleCheckmarkIcon } from "./components/Icons";
import { KeywordEntries } from "./components/KeywordEntries";
import { KeywordEntry, ListType, MessageJsonFixed } from "./types";


interface ScrollerContext {
    id: string;
    onKeyDown: () => void;
    orientation: string;
    ref: RefObject<unknown>;
    tabIndex: number;
}

interface ScrollerOpts {
    role: string;
    tabIndex: ScrollerContext["tabIndex"];
    "data-list-id": ScrollerContext["id"];
    onKeyDown: ScrollerContext["onKeyDown"];
    ref: ScrollerContext["ref"];
    "aria-orientation": ScrollerContext["orientation"];
}

const scrollerClass = findCssClassesLazy("singleMessage", "scroller");
const tabClass = findCssClassesLazy("inboxTitle", "tab");
const PopoutContainer = findByCodeLazy("navigator", "containerProps");
const createNavigator = findByCodeLazy("keyboardModeEnabled)", "scrollIntoViewNode");
const createMessageRecord = findByCodeLazy(".createFromServer(", ".isBlockedForMessage", "messageReference:");
const useScrollerEvents: (ref: RefObject<unknown>) => void = findByCodeLazy("scrollPageUp", "subscribe");


export const KEYWORD_ENTRIES_KEY = "KeywordNotify_keywordEntries";
const KEYWORD_LOG_KEY = "KeywordNotify_log";
const TAB_ID = 333;

export const cl = classNameFactory("vc-keywordnotify-");

let keywordLog: Message[] = [];
let interceptor: (e: any) => void;


export async function addKeywordEntry() {
    settings.store.keywordEntries.push({
        enabled: true,
        regex: "",
        ignoreCase: false,
        ignoreBots: true,
        whitelist: [],
        blacklist: [],
        listPriority: ListType.BlackList,
    });
    await DataStore.set(KEYWORD_ENTRIES_KEY, settings.plain.keywordEntries);
}

export async function removeKeywordEntry(idx: number) {
    settings.store.keywordEntries.splice(idx, 1);
    await DataStore.set(KEYWORD_ENTRIES_KEY, settings.plain.keywordEntries);
}

function safeMatchesRegex(str: string, regex: string, flags: string) {
    try {
        return str.match(new RegExp(regex, flags));
    } catch {
        return false;
    }
}

function highlightKeywords(str: string, entries: KeywordEntry[]) {
    let regexes: RegExp[];
    try {
        regexes = entries.map(e => new RegExp(e.regex, "g" + (e.ignoreCase ? "i" : "")));
    } catch (err) {
        return [str];
    }

    const matches = regexes.map(r => str.match(r)).flat().filter(e => e != null) as string[];
    if (matches.length === 0) {
        return [str];
    }

    const idx = str.indexOf(matches[0]);

    return (
        <>
            <span>{str.substring(0, idx)}</span>
            <span className="highlight">{matches[0]}</span>
            <span>{str.substring(idx + matches[0].length)}</span>
        </>
    );
}

export const settings = definePluginSettings({
    amountToKeep: {
        type: OptionType.NUMBER,
        description: "Amount of messages to keep in the log",
        default: 50,
    },
    keywordsComponent: {
        type: OptionType.COMPONENT,
        description: "Manage keywords",
        component: () => <KeywordEntries />,
    },
    keywordEntries: {
        type: OptionType.CUSTOM,
        default: [] as KeywordEntry[],
    },
});

export default definePlugin({
    name: "KeywordNotify",
    authors: [
        {
            name: "camila314",
            id: 738592270617542716n,
        },
        {
            name: "x3rt",
            id: 131602100332396544n,
        },
        {
            name: "benjas333",
            id: 456577284464443394n,
        },
    ],
    description: "Sends a notification if a given message matches certain keywords or regexes",
    settings,
    patches: [
        {
            find: "#{intl::MENTIONS})",
            group: true,
            replacement: [
                {
                    match: /,(?:(?:\i&&)?\i\?\(0,\i\.jsxs?\)\(\i\.\i\.Item)/,
                    replace: ",$self.keywordTabBar()$&",
                },
                {
                    match: /:(\i)===\i\.\i\.MENTIONS\?\(0,.{0,500}null}/,
                    replace: `: $1 === ${TAB_ID} ? $self.keywordClearButton() $&`,
                },
                {
                    match: /:(\i)===\i\.\i\.MENTIONS\?\(0,.{0,500}onJump:(\i)}\)/,
                    replace: `: $1 === ${TAB_ID} ? $self.tryKeywordMenu({ onJump: $2}) $&`,
                },
                {
                    match: /function (\i)\(\i\){let{message:\i,onJump/,
                    replace: "$self.RenderMsg = $1; $&",
                },
                {
                    match: /onClick:\(\)=>(\i\.\i\.deleteRecentMention\((\i)\.id\))/,
                    replace: "onClick: () => $2._keyword ? $self.deleteMessageHelper($2.id) : $1",
                },
            ]
        },
    ],
    toolboxActions: {
        async "Open Plugin Settings"() {
            openPluginModal(plugins.KeywordNotify);
        }
    },

    async start() {
        this.onUpdate = () => null;

        // TODO: remove migration
        // store migration
        if (!settings.store.keywordEntries.length) {
            settings.store.keywordEntries = await DataStore.get(KEYWORD_ENTRIES_KEY) ?? [];
        }
        // sort and duplicated migration fix
        DataStore.get<string[]>(KEYWORD_LOG_KEY).then(log => {
            let parsed_logs = log?.map(e => JSON.parse(e) as MessageJsonFixed) ?? [];

            parsed_logs = parsed_logs.toSorted((a, b) => b.timestamp.localeCompare(a.timestamp));

            parsed_logs = [...new Map(parsed_logs.map(e => [e.id, e])).values()];

            DataStore.set(KEYWORD_LOG_KEY, parsed_logs.map(e => JSON.stringify(e)));
        });
        // add enabled param migration
        settings.store.keywordEntries.forEach(entry => {
            entry.enabled = entry.enabled ?? true;
        });

        // NOTE: consider removing DataStore for KEYWORD_ENTRIES_KEY at all
        await DataStore.set(KEYWORD_ENTRIES_KEY, settings.plain.keywordEntries);

        (await DataStore.get<string[]>(KEYWORD_LOG_KEY) ?? []).map(e => JSON.parse(e) as MessageJsonFixed).forEach(e => {
            try {
                this.addToLog(e);
            } catch (err) {
                console.error(err);
            }
        });

        interceptor = (e: any) => {
            return this.modify(e);
        };
        FluxDispatcher.addInterceptor(interceptor);
    },

    stop() {
        const index = FluxDispatcher._interceptors.indexOf(interceptor);
        if (index > -1) {
            FluxDispatcher._interceptors.splice(index, 1);
        }
    },

    doesMatchAnyKeyword(m: MessageJsonFixed): boolean {
        for (const entry of settings.store.keywordEntries) {
            if (!entry.enabled || entry.regex === "") continue;

            let isInWhitelist = entry.whitelist.some(id => {
                const trimmed = id.trim();
                return trimmed === m.channel_id || trimmed === m.author.id;
            });
            if (!isInWhitelist) {
                const channel = ChannelStore.getChannel(m.channel_id);
                if (channel != null) {
                    isInWhitelist = entry.whitelist.some(id => id.trim() === channel.guild_id);
                }
            }

            let isInBlacklist = entry.blacklist.some(id => {
                const trimmed = id.trim();
                return trimmed === m.channel_id || trimmed === m.author.id;
            });
            if (!isInBlacklist) {
                const channel = ChannelStore.getChannel(m.channel_id);
                if (channel != null) {
                    isInBlacklist = entry.blacklist.some(id => id.trim() === channel.guild_id);
                }
            }


            if (isInWhitelist && isInBlacklist) {
                if (entry.listPriority === ListType.BlackList) continue;
            } else {
                if (entry.whitelist.length && !isInWhitelist) continue;

                if (isInBlacklist) continue;
            }

            if (m.author.bot && entry.ignoreBots && (!entry.whitelist.length || !entry.whitelist.includes(m.author.id))) {
                continue;
            }

            const flags = entry.ignoreCase ? "i" : "";
            if (safeMatchesRegex(m.content, entry.regex, flags)) {
                return true;
            }

            for (const embed of m.embeds) {
                if (safeMatchesRegex(embed.description, entry.regex, flags) || safeMatchesRegex(embed.title, entry.regex, flags)) {
                    return true;
                }

                if (embed.fields == null) continue;

                for (const field of embed.fields) {
                    if (safeMatchesRegex(field.value, entry.regex, flags) || safeMatchesRegex(field.name, entry.regex, flags)) {
                        return true;
                    }
                }
            }
        }

        return false;
    },

    applyKeywordEntries(m: MessageJsonFixed) {
        if (!this.doesMatchAnyKeyword(m)) return;

        const user = UserStore.getCurrentUser();
        if (user != null) {
            m.mentions.push({
                id: user.id,
                avatar: user.avatar,
                avatarDecoration: user.avatarDecoration,
                discriminator: user.discriminator,
                globalName: user.globalName,
                publicFlags: user.publicFlags,
                username: user.username,
            });
        }

        if (m.author.id !== user?.id) {
            this.addMessageHelper(m);
        }
    },

    storeMessage(m: MessageJsonFixed) {
        if (m == null) return;

        DataStore.get<string[]>(KEYWORD_LOG_KEY).then(log => {
            let parsed_logs = log?.map(e => JSON.parse(e) as MessageJsonFixed) ?? [];

            const repeatedIndex = parsed_logs.findIndex(e => e.id === m.id);
            if (repeatedIndex < 0) {
                parsed_logs.push(m);
            } else {
                const repeatedMessage = parsed_logs[repeatedIndex];
                if (repeatedMessage.edited_timestamp === m.edited_timestamp) return;

                parsed_logs[repeatedIndex] = m;
            }
            parsed_logs = parsed_logs.toSorted((a, b) => b.timestamp.localeCompare(a.timestamp));

            while (parsed_logs.length > settings.store.amountToKeep) {
                parsed_logs.pop();
            }

            DataStore.set(KEYWORD_LOG_KEY, parsed_logs.map(e => JSON.stringify(e)));
        });
    },

    discardMessage(id: string) {
        DataStore.get<string[]>(KEYWORD_LOG_KEY).then(log => {
            let parsed_logs = log?.map(e => JSON.parse(e) as MessageJsonFixed) ?? [];

            parsed_logs = parsed_logs.filter(msg => msg.id !== id);

            DataStore.set(KEYWORD_LOG_KEY, parsed_logs.map(e => JSON.stringify(e)));
        });
    },

    addToLog(m: MessageJsonFixed) {
        if (m == null) return;

        let messageRecord: Message;
        try {
            messageRecord = createMessageRecord(m);
        } catch (err) {
            console.error(err);
            return;
        }

        const repeatedIndex = keywordLog.findIndex(e => e.id === messageRecord.id);
        if (repeatedIndex < 0) {
            keywordLog.push(messageRecord);
        } else {
            const repeatedMessage = keywordLog[repeatedIndex];
            if (repeatedMessage.editedTimestamp === messageRecord.editedTimestamp) return;

            keywordLog[repeatedIndex] = messageRecord;
        }

        keywordLog.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        while (keywordLog.length > settings.store.amountToKeep) {
            keywordLog.pop();
        }

        this.onUpdate();
    },

    deleteFromLog(id: string) {
        keywordLog = keywordLog.filter(e => e.id !== id);

        this.onUpdate();
    },

    addMessageHelper(m: MessageJsonFixed) {
        this.storeMessage(m);
        this.addToLog(m);
    },

    deleteMessageHelper(id: string) {
        this.discardMessage(id);
        this.deleteFromLog(id);
    },

    keywordTabBar() {
        return (
            <TabBar.Item className={classes(tabClass.tab)} id={TAB_ID}>
                Keywords
            </TabBar.Item>
        );
    },

    keywordClearButton() {
        return (
            <Tooltip text="Clear All">
                {({ onMouseLeave, onMouseEnter }) => (
                    <Button
                        variant="secondary"
                        size="iconOnly"
                        onMouseLeave={onMouseLeave}
                        onMouseEnter={onMouseEnter}
                        onClick={() => {
                            keywordLog = [];
                            DataStore.set(KEYWORD_LOG_KEY, []);

                            this.onUpdate();
                        }}>
                        <DoubleCheckmarkIcon />
                    </Button>
                )}
            </Tooltip>
        );
    },

    tryKeywordMenu({ onJump }: { onJump: () => void; }) {
        const [tempLogs, setKeywordLog] = useState(keywordLog);
        const navigatorScrollerRef = useRef<ScrollerBaseRef | null>(null);

        const navigator = createNavigator("keywords", navigatorScrollerRef);

        useScrollerEvents(navigatorScrollerRef);

        this.onUpdate = () => {
            const newLog = Array.from(keywordLog);
            setKeywordLog(newLog);
        };

        const RenderMsgWrapper = (message: Message & { _keyword?: boolean; }): JSX.Element => {
            message._keyword = true;

            message.customRenderedContent = {
                content: highlightKeywords(message.content, settings.store.keywordEntries)
            };

            return this.RenderMsg({
                message,
                onJump,
            });
        };

        return (
            <ErrorBoundary>
                <PopoutContainer navigator={navigator}>
                    <ScrollerThin
                        ref={navigatorScrollerRef}
                        className={classes(scrollerClass.scroller)}
                        onScroll={void 0}
                    >
                        {tempLogs.map(m => <div key={m.id}>{RenderMsgWrapper(m)}</div>)}
                    </ScrollerThin>
                </PopoutContainer>
            </ErrorBoundary>
        );
    },

    modify(e: any) {
        if (e.type === "MESSAGE_CREATE" || e.type === "MESSAGE_UPDATE") {
            this.applyKeywordEntries(e.message);
        } else if (e.type === "LOAD_MESSAGES_SUCCESS") {
            for (let msg = 0; msg < e.messages.length; ++msg) {
                this.applyKeywordEntries(e.messages[msg]);
            }
        }
    },
});
