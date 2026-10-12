import {
    App,
    TFile
} from "obsidian";

import {
    TaskTimelineSettings
} from "settings";

export const ADJUSTMENT_MARKER = "корректировка расписания";

export interface ScheduleItem {
    name: string;
    duration: number;
}

export interface TaskData {
    name: string;
    path: string;
    duration: number;
    completed: boolean;
    colorIndex: number;
}

export interface ParsedTimelineData {
    dayStart: number;
    dayEnd: number;
    availableMinutes: number;
    blockedMinutes: number;

    baseScheduleMinutes: number;
    taskMinutes: number;

    scheduleAdjustment: number;

    scheduleItems: ScheduleItem[];
    tasks: TaskData[];

    dependencyPaths: Set<string>;
    sourcePath: string;
}

export function parseDuration(
    value: unknown
): number {
    if (value == null) {
        return 0;
    }

    const str = String(value).trim();

    const timeMatch = str.match(
        /^(\d+):([0-5]\d)$/
    );

    if (timeMatch) {
        return (
            Number(timeMatch[1]) * 60 +
            Number(timeMatch[2])
        );
    }

    const minutes = Number(str);

    return Number.isFinite(minutes)
        ? minutes
        : 0;
}

export function parseTime(
    value: unknown
): number | null {
    if (value == null) {
        return null;
    }

    const match = String(value)
        .trim()
        .match(
            /^(\d{1,2}):([0-5]\d)$/
        );

    if (!match) {
        return null;
    }

    return (
        Number(match[1]) * 60 +
        Number(match[2])
    );
}

export function parseAdjustment(
    value: unknown
): number {
    if (value == null) {
        return 0;
    }

    const str = String(value)
        .trim()
        .replace(/\s+/g, "");

    if (!str) {
        return 0;
    }

    const timeMatch = str.match(
        /^([+-])?(\d+):([0-5]\d)$/
    );

    if (timeMatch) {
        const sign =
            timeMatch[1] === "-"
                ? -1
                : 1;

        return sign * (
            Number(timeMatch[2]) * 60 +
            Number(timeMatch[3])
        );
    }

    const minutes = Number(str);

    return Number.isFinite(minutes)
        ? minutes
        : 0;
}

export function formatDuration(
    minutes: number
): string {
    const sign =
        minutes < 0
            ? "-"
            : "";

    const absolute =
        Math.abs(
            Math.round(minutes)
        );

    const hours =
        Math.floor(
            absolute / 60
        );

    const mins =
        absolute % 60;

    if (hours > 0 && mins > 0) {
        return (
            `${sign}${hours} ч ` +
            `${mins} мин`
        );
    }

    if (hours > 0) {
        return (
            `${sign}${hours} ч`
        );
    }

    return (
        `${sign}${mins} мин`
    );
}

export function formatAdjustment(
    minutes: number
): string {
    minutes = Math.round(minutes);

    if (minutes === 0) {
        return "0:00";
    }

    const sign =
        minutes < 0
            ? "-"
            : "+";

    const absolute =
        Math.abs(minutes);

    const hours =
        Math.floor(
            absolute / 60
        );

    const mins =
        absolute % 60;

    return (
        `${sign}${hours}:` +
        `${String(mins).padStart(2, "0")}`
    );
}

export function parseDateFromFilename(
    filename: string
): Date {
    const match = filename.match(
        /^(\d{2})\.(\d{2})\.(\d{2})$/
    );

    if (!match) {
        return new Date();
    }

    const day =
        Number(match[1]);

    const month =
        Number(match[2]);

    const year =
        2000 + Number(match[3]);

    const date =
        new Date(
            year,
            month - 1,
            day
        );

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return new Date();
    }

    return date;
}

export function getSchedulePath(
    filename: string,
    settings: TaskTimelineSettings
): string {

    const date =
        parseDateFromFilename(
            filename
        );


    const isWorkDay =
        isScheduledWorkDay(
            date,
            settings
        );


    return isWorkDay
        ? settings.weekdaySchedulePath
        : settings.weekendSchedulePath;
}


export function isScheduledWorkDay(
    date: Date,
    settings: TaskTimelineSettings
): boolean {

    const cycle =
        getScheduleCycle(
            settings
        );


    // --------------------------------------------------
    // Старое поведение 5/2 при отсутствии
    // даты начала цикла.
    // --------------------------------------------------

    if (
        settings.schedulePreset === "5/2" &&
        !settings.cycleStartDate
    ) {

        const day =
            date.getDay();

        return (
            day !== 0 &&
            day !== 6
        );
    }


    // Для 2/2, 3/3 и custom дата начала
    // должна быть определена.
    //
    // Если настройки были созданы до появления
    // циклических графиков, безопаснее временно
    // использовать Пн–Пт.

    if (
        !settings.cycleStartDate
    ) {

        const day =
            date.getDay();

        return (
            day !== 0 &&
            day !== 6
        );
    }


    const start =
        new Date(
            `${settings.cycleStartDate}T00:00:00`
        );


    if (
        Number.isNaN(
            start.getTime()
        )
    ) {

        const day =
            date.getDay();

        return (
            day !== 0 &&
            day !== 6
        );
    }


    const current =
        new Date(date);

    current.setHours(
        0,
        0,
        0,
        0
    );


    start.setHours(
        0,
        0,
        0,
        0
    );


    const diff =
        Math.floor(
            (
                current.getTime() -
                start.getTime()
            ) /
            86400000
        );


    const index =
        (
            (
                diff %
                cycle.length
            ) +
            cycle.length
        ) %
        cycle.length;


    return cycle[index];
}


export function getScheduleCycle(
    settings: TaskTimelineSettings
): boolean[] {

    switch (
        settings.schedulePreset
    ) {

        case "5/2":

            return [
                true,
                true,
                true,
                true,
                true,
                false,
                false
            ];


        case "2/2":

            return [
                true,
                true,
                false,
                false
            ];


        case "3/3":

            return [
                true,
                true,
                true,
                false,
                false,
                false
            ];


        case "custom":

            return (
                settings.customCycle.length > 0
                    ? settings.customCycle
                    : [true]
            );
    }
}

function getCycleStartDate(
    settings: TaskTimelineSettings
): Date | null {

    if (
        !settings.cycleStartDate
    ) {
        return null;
    }


    const date =
        new Date(
            `${settings.cycleStartDate}T00:00:00`
        );


    return Number.isNaN(
        date.getTime()
    )
        ? null
        : date;
}

function extractFrontmatterValue(
    content: string,
    key: string
): string | null {
    const match =
        content.match(
            /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/
        );

    if (!match) {
        return null;
    }

    const frontmatter =
        match[1];

    const keyRegex =
        new RegExp(
            `^${escapeRegExp(key)}\\s*:\\s*(.*?)\\s*$`,
            "mi"
        );

    const valueMatch =
        frontmatter.match(keyRegex);

    return valueMatch
        ? valueMatch[1].trim()
        : null;
}

function extractInlineValue(
    content: string,
    key: string
): string | null {
    const regex =
        new RegExp(
            `^\\s*${escapeRegExp(key)}\\s*::\\s*(.*?)\\s*$`,
            "mi"
        );

    const match =
        content.match(regex);

    return match
        ? match[1].trim()
        : null;
}

function getPageProperty(
    file: TFile,
    content: string,
    key: string,
    app: App
): unknown {
    const cache =
        app.metadataCache.getFileCache(
            file
        );

    const frontmatter =
        cache?.frontmatter;

    if (
        frontmatter &&
        Object.prototype.hasOwnProperty.call(
            frontmatter,
            key
        )
    ) {
        return frontmatter[key];
    }

    const frontmatterValue =
        extractFrontmatterValue(
            content,
            key
        );

    if (
        frontmatterValue !== null
    ) {
        return frontmatterValue;
    }

    return extractInlineValue(
        content,
        key
    );
}

export function getScheduleAdjustment(
    content: string
): number {
    const regex =
        new RegExp(
            `%%\\s*${escapeRegExp(
                ADJUSTMENT_MARKER
            )}\\s*:\\s*(-?\\d+)\\s*%%`,
            "i"
        );

    const match =
        content.match(regex);

    if (!match) {
        return 0;
    }

    return parseAdjustment(
        match[1]
    );
}

export async function parseTimelineData(
    app: App,
    sourceFile: TFile,
    settings: TaskTimelineSettings
): Promise<ParsedTimelineData> {
    const sourceContent =
        await app.vault.cachedRead(
            sourceFile
        );

    const sourceDate =
        parseDateFromFilename(
            sourceFile.basename
        );

    const schedulePath =
        getSchedulePath(
            sourceFile.basename,
            settings
        );

    const scheduleFile =
        app.metadataCache.getFirstLinkpathDest(
            schedulePath,
            sourceFile.path
        );

    let dayStart = 0;
    let dayEnd = 0;

    const scheduleItems:
        ScheduleItem[] = [];

    const dependencyPaths =
        new Set<string>();

    dependencyPaths.add(
        sourceFile.path
    );

    if (scheduleFile) {
        dependencyPaths.add(
            scheduleFile.path
        );
    }

    if (scheduleFile) {
        const scheduleContent =
            await app.vault.cachedRead(
                scheduleFile
            );

        const startValue =
            getPageProperty(
                scheduleFile,
                scheduleContent,
                "начало дня",
                app
            );

        const endValue =
            getPageProperty(
                scheduleFile,
                scheduleContent,
                "конец дня",
                app
            );

        const parsedStart =
            parseTime(startValue);

        const parsedEnd =
            parseTime(endValue);

        if (
            parsedStart !== null &&
            parsedEnd !== null
        ) {
            dayStart =
                parsedStart;

            dayEnd =
                parsedEnd;
        }

        const lines =
            scheduleContent.split(
                /\r?\n/
            );

        for (const line of lines) {
            const match =
                line.match(
                    /^\s*[-*+]\s+(.*?)\s+(\d+:\d{2})\s*$/
                );

            if (!match) {
                continue;
            }

            const name =
                match[1].trim();

            const duration =
                parseDuration(
                    match[2]
                );

            if (
                !name ||
                duration <= 0
            ) {
                continue;
            }

            scheduleItems.push({
                name,
                duration
            });
        }
    }

    const tasks:
        TaskData[] = [];

    const lines =
        sourceContent.split(
            /\r?\n/
        );

    let colorIndex = 0;

    for (
        let i = 0;
        i < lines.length;
        i++
    ) {
        const line = lines[i];

        const taskMatch =
            line.match(
                /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/
            );

        if (!taskMatch) {
            continue;
        }

        const completed =
            taskMatch[1]
                .toLowerCase() === "x";

        const taskText =
            taskMatch[2];

        const link =
            extractFirstLink(
                taskText
            );

        if (!link) {
            continue;
        }

        const linkedFile =
            app.metadataCache
                .getFirstLinkpathDest(
                    link.path,
                    sourceFile.path
                );

        if (!linkedFile) {
            continue;
        }

        dependencyPaths.add(
            linkedFile.path
        );

        const linkedContent =
            await app.vault.cachedRead(
                linkedFile
            );

        const durationValue =
            getPageProperty(
                linkedFile,
                linkedContent,
                "требует времени",
                app
            );

        const duration =
            parseDuration(
                durationValue
            );

        if (duration <= 0) {
            continue;
        }

        const name =
            link.display ||
            linkedFile.basename;

        tasks.push({
            name,
            path: linkedFile.path,
            duration,
            completed,
            colorIndex
        });

        colorIndex++;
    }

    const availableMinutes =
        Math.max(
            0,
            dayEnd - dayStart
        );

    const blockedMinutes =
        1440 -
        availableMinutes;

    const baseScheduleMinutes =
        scheduleItems.reduce(
            (sum, item) =>
                sum + item.duration,
            0
        );

    const taskMinutes =
        tasks.reduce(
            (sum, task) =>
                sum + task.duration,
            0
        );

    const scheduleAdjustment =
        getScheduleAdjustment(
            sourceContent
        );

    void sourceDate;

    return {
        dayStart,
        dayEnd,
        availableMinutes,
        blockedMinutes,

        baseScheduleMinutes,
        taskMinutes,

        scheduleAdjustment,

        scheduleItems,
        tasks,

        dependencyPaths,
        sourcePath:
            sourceFile.path
    };
}

interface ParsedLink {
    path: string;
    display: string;
}

function extractFirstLink(
    text: string
): ParsedLink | null {
    const wikiLink =
        text.match(
            /\[\[([^\]]+)\]\]/
        );

    if (wikiLink) {
        const raw =
            wikiLink[1];

        const separator =
            raw.indexOf("|");

        if (separator >= 0) {
            return {
                path:
                    raw
                        .slice(
                            0,
                            separator
                        )
                        .trim(),
                display:
                    raw
                        .slice(
                            separator + 1
                        )
                        .trim()
            };
        }

        return {
            path: raw.trim(),
            display: ""
        };
    }

    const markdownLink =
        text.match(
            /\[[^\]]*\]\(([^)]+)\)/
        );

    if (markdownLink) {
        return {
            path:
                markdownLink[1].trim(),
            display: ""
        };
    }

    return null;
}

function escapeRegExp(
    value: string
): string {
    return value.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}
