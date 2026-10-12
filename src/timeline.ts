import {
    App,
    MarkdownRenderChild,
    TFile
} from "obsidian";

import {
    ADJUSTMENT_MARKER,
    ParsedTimelineData,
    formatAdjustment,
    formatDuration,
    parseTimelineData
} from "./parser";

import {
    AdjustmentModal
} from "./modal";

const TASK_COLORS = [
    "#4C78A8",
    "#F58518",
    "#E45756",
    "#B279A2",
    "#FF9DA6",
    "#9D755D",
    "#72B7B2"
];

const SCHEDULE_COLOR =
    "#888888";

const TASK_COLOR =
    "#e28e16";

const FREE_COLOR =
    "#63A35C";

const MIN_SEGMENT_WIDTH =
    4;

export class TaskTimelineView
    extends MarkdownRenderChild {

    private readonly app: App;

    private readonly sourcePath: string;

    private refreshInProgress = false;
    private refreshPending = false;
    private isLoading = false;

    private mainTrack:
        HTMLDivElement | null = null;

    private overflowTrack:
        HTMLDivElement | null = null;

    private labels:
        HTMLDivElement | null = null;

    private blockedStat:
        HTMLDivElement | null = null;

    private scheduleStat:
        HTMLDivElement | null = null;

    private tasksStat:
        HTMLDivElement | null = null;

    private freeStat:
        HTMLDivElement | null = null;

    private root:
        HTMLDivElement | null = null;

    private data:
        ParsedTimelineData | null = null;

    private refreshTimer:
        number | null = null;

    private modal:
        AdjustmentModal | null = null;

    private scheduleLabel:
        HTMLDivElement | null = null;

    private freeLabel:
        HTMLDivElement | null = null;

    private onUnloadCallback:
        (() => void) | null = null;

    constructor(
        app: App,
        containerEl: HTMLElement,
        sourcePath: string,
        private readonly getSettings: () => {
            weekdaySchedulePath: string;
            weekendSchedulePath: string;
        }
    ) {
        super(containerEl);

        this.app = app;

        this.sourcePath = sourcePath;
    }

    onload(): void {
        this.buildShell();

        this.showLoading();

        void this.refresh();

        this.registerEvent(
            this.app.vault.on(
                "modify",
                file => {
                    if (
                        this.shouldRefreshForFile(
                            file
                        )
                    ) {
                        this.scheduleRefresh();
                    }
                }
            )
        );
    }

    setOnUnload(
        callback: () => void
    ): void {
        this.onUnloadCallback = callback;
    }

    onunload(): void {
        if (
            this.refreshTimer !== null
        ) {
            window.clearTimeout(
                this.refreshTimer
            );

            this.refreshTimer =
                null;
        }


        this.modal =
            null;


        this.onUnloadCallback?.();

        this.onUnloadCallback =
            null;


        super.onunload();
    }

    private buildShell(): void {
        this.containerEl.empty();

        const root =
            this.containerEl.createDiv({
                cls: "task-timeline"
            });

        this.root =
            root;

        this.mainTrack =
            root.createDiv({
                cls:
                    "task-timeline-track " +
                    "task-timeline-main-track"
            });

        this.mainTrack.dataset.role =
            "main-track";

        this.mainTrack.setAttribute(
            "title",
            "Нажмите, чтобы изменить " +
            "продолжительность расписания"
        );

        this.mainTrack.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                this.openAdjustmentModal();
            }
        );

        this.overflowTrack =
            root.createDiv({
                cls:
                    "task-timeline-track " +
                    "task-timeline-overflow-track"
            });

        this.overflowTrack.dataset.role =
            "overflow-track";

        this.overflowTrack.setAttribute(
            "title",
            "Нажмите, чтобы изменить " +
            "продолжительность расписания"
        );

        this.overflowTrack.style.display =
            "none";

        this.overflowTrack.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                this.openAdjustmentModal();
            }
        );

        this.labels =
            root.createDiv({
                cls:
                    "task-timeline-labels"
            });

        this.createTimeLabels();

        const statistics =
            root.createDiv({
                cls:
                    "task-timeline-statistics"
            });

        const blocked =
    this.createStatistic(
        statistics,
        "заблокировано"
    );

    this.blockedStat =
        blocked.value;


    const schedule =
        this.createStatistic(
            statistics,
            "расписание"
        );

    this.scheduleStat =
        schedule.value;

    this.scheduleLabel =
        schedule.label;


    const tasks =
        this.createStatistic(
            statistics,
            "задачи"
        );

    this.tasksStat =
        tasks.value;


    const free =
        this.createStatistic(
            statistics,
            "свободно"
        );

    this.freeStat =
        free.value;

    this.freeLabel =
        free.label;
    }

    private createStatistic(
        parent: HTMLElement,
        label: string
    ): {
        value: HTMLDivElement;
        label: HTMLDivElement;
    } {

        const item =
            parent.createDiv({
                cls:
                    "task-timeline-stat"
            });


        const value =
            item.createDiv({
                cls:
                    "task-timeline-stat-value"
            });


        const labelElement =
            item.createDiv({
                cls:
                    "task-timeline-stat-label",
                text:
                    label
            });


        return {
            value,
            label:
                labelElement
        };
    }

    private createTimeLabels(): void {
        if (!this.labels) {
            return;
        }

        this.labels.empty();

        for (
            let hour = 0;
            hour <= 24;
            hour += 3
        ) {
            const label =
                this.labels.createSpan({
                    cls:
                        "task-timeline-time-label",
                    text:
                        `${hour}ч`
                });

            label.style.left =
                `${hour / 24 * 100}%`;

            if (hour === 0) {
                label.style.transform =
                    "translateX(0)";
            } else if (
                hour === 24
            ) {
                label.style.transform =
                    "translateX(-100%)";
            } else {
                label.style.transform =
                    "translateX(-50%)";
            }
        }
    }

    private showLoading(): void {
        // Анимация уже существует.
        // Не пересоздаём DOM и не сбрасываем её.

        if (this.isLoading) {
            return;
        }

        this.isLoading = true;


        if (this.mainTrack) {

            this.mainTrack.empty();

            this.mainTrack.style.display =
                "block";

            this.mainTrack.createDiv({
                cls:
                    "task-timeline-loading-bar"
            });
        }


        const spinner =
            `<span class="task-timeline-spinner"></span>`;


        if (this.blockedStat) {
            this.blockedStat.innerHTML =
                spinner;
        }

        if (this.scheduleStat) {
            this.scheduleStat.innerHTML =
                spinner;
        }

        if (this.tasksStat) {
            this.tasksStat.innerHTML =
                spinner;
        }

        if (this.freeStat) {
            this.freeStat.innerHTML =
                spinner;
        }
    }

    async refresh(): Promise<void> {

        // Уже идёт обновление.
        // Запоминаем, что после него нужно
        // выполнить ещё одно.
        if (this.refreshInProgress) {
            this.refreshPending = true;
            return;
        }

        this.refreshInProgress = true;
        this.refreshPending = false;

        try {

            const file =
                this.app.vault.getFileByPath(
                    this.sourcePath
                );


            // Файл пока недоступен.
            // Оставляем существующую анимацию
            // и пробуем ещё раз позже.

            if (!file) {

                this.showLoading();

                this.refreshPending = true;

                return;
            }


            const data =
                await parseTimelineData(
                    this.app,
                    file,
                    this.getSettings()
                );


            this.data =
                data;

            this.isLoading =
                false;

            this.updateUI();

        } catch (error) {

            this.isLoading =
                false;

            console.error(
                "Task Timeline:",
                error
            );

            this.showError(
                error instanceof Error
                    ? error.message
                    : String(error)
            );

        } finally {

            this.refreshInProgress =
                false;


            // Если во время текущего
            // обновления пришло ещё одно
            // изменение — выполняем один
            // дополнительный refresh.

            if (
                this.refreshPending
            ) {

                this.refreshPending =
                    false;

                this.scheduleRefresh(120);
            }
        }
    }

    private scheduleRefresh(
    delay = 120
    ): void {

        if (
            this.refreshTimer !== null
        ) {
            window.clearTimeout(
                this.refreshTimer
            );
        }

        this.refreshTimer =
            window.setTimeout(
                () => {

                    this.refreshTimer =
                        null;

                    void this.refresh();

                },
                delay
            );
    }

    private shouldRefreshForFile(
        file: TFile
    ): boolean {
        if (!this.data) {
            return (
                file.path ===
                this.sourcePath
            );
        }

        return this.data.dependencyPaths
            .has(file.path);
    }

    private updateUI(): void {
        if (
            !this.data
        ) {
            return;
        }

        const {
            scheduleMinutes,
            freeMinutes
        } =
            this.calculateCurrentState();

        this.renderTracks(
            scheduleMinutes,
            freeMinutes
        );

        this.renderStatistics(
            scheduleMinutes,
            freeMinutes
        );
    }

    private calculateCurrentState(): {
        scheduleMinutes: number;
        freeMinutes: number;
    } {
        if (!this.data) {
            return {
                scheduleMinutes: 0,
                freeMinutes: 0
            };
        }

        const scheduleMinutes =
            Math.max(
                0,
                this.data
                    .baseScheduleMinutes +
                this.data
                    .scheduleAdjustment
            );

        const freeMinutes =
            this.data.availableMinutes -
            scheduleMinutes -
            this.data.taskMinutes;

        return {
            scheduleMinutes,
            freeMinutes
        };
    }

    private renderTracks(
        scheduleMinutes: number,
        freeMinutes: number
    ): void {
        if (
            !this.mainTrack ||
            !this.overflowTrack
        ) {
            return;
        }

        this.mainTrack.empty();

        if (
            freeMinutes >= 0
        ) {
            this.mainTrack.style.display =
                "block";

            this.renderMainTrack(
                this.mainTrack,
                scheduleMinutes,
                freeMinutes
            );
        } else {
            this.mainTrack.style.display =
                "none";
        }

        this.overflowTrack.empty();

        if (
            freeMinutes < 0
        ) {
            this.overflowTrack.style.display =
                "block";

            this.renderOverflowTrack(
                this.overflowTrack,
                scheduleMinutes
            );
        } else {
            this.overflowTrack.style.display =
                "none";
        }

        if (this.labels) {
            this.labels.style.display =
                (
                    freeMinutes >= 0 ||
                    freeMinutes < 0
                )
                    ? "block"
                    : "none";
        }
    }

    private renderMainTrack(
        track: HTMLElement,
        scheduleMinutes: number,
        freeMinutes: number
    ): void {
        if (!this.data) {
            return;
        }

        let cursor = 0;

        if (
            this.data.blockedMinutes > 0
        ) {
            this.addSegment(
                track,
                cursor,
                cursor +
                    this.data
                        .blockedMinutes,
                "var(--background-modifier-border)",
                1,
                `Заблокировано — ${
                    formatDuration(
                        this.data
                            .blockedMinutes
                    )
                }`
            );

            cursor +=
                this.data.blockedMinutes;
        }

        if (
            scheduleMinutes > 0
        ) {
            this.addSegment(
                track,
                cursor,
                cursor +
                    scheduleMinutes,
                SCHEDULE_COLOR,
                0.8,
                `Расписание — ${
                    formatDuration(
                        scheduleMinutes
                    )
                }`
            );

            cursor +=
                scheduleMinutes;
        }

        const visibleTaskMinutes =
            Math.min(
                this.data.taskMinutes,
                Math.max(
                    0,
                    1440 - cursor
                )
            );

        if (
            visibleTaskMinutes > 0
        ) {
            this.addSegment(
                track,
                cursor,
                cursor +
                    visibleTaskMinutes,
                TASK_COLOR,
                0.9,
                `Задачи — ${
                    formatDuration(
                        visibleTaskMinutes
                    )
                }`
            );

            cursor +=
                visibleTaskMinutes;
        }

        if (
            freeMinutes > 0
        ) {
            this.addSegment(
                track,
                cursor,
                cursor +
                    freeMinutes,
                FREE_COLOR,
                0.9,
                `Свободно — ${
                    formatDuration(
                        freeMinutes
                    )
                }`
            );
        }
    }

    private renderOverflowTrack(
        track: HTMLElement,
        scheduleMinutes: number
    ): void {
        if (!this.data) {
            return;
        }

        let cursor =
            this.data.blockedMinutes +
            scheduleMinutes;

        let overflowCursor = 0;

        for (
            const task
            of this.data.tasks
        ) {
            const start =
                cursor;

            const end =
                start +
                task.duration;

            if (
                end > 1440
            ) {
                const overflowStart =
                    Math.max(
                        start,
                        1440
                    );

                const duration =
                    end -
                    overflowStart;

                if (
                    duration > 0
                ) {
                    this.addSegment(
                        track,
                        overflowCursor,
                        overflowCursor +
                            duration,
                        this.getTaskColor(
                            task.colorIndex
                        ),
                        task.completed
                            ? 0.45
                            : 0.9,
                        `${task.name} — ${
                            formatDuration(
                                duration
                            )
                        }`,
                        true
                    );

                    overflowCursor +=
                        duration;
                }
            }

            cursor = end;
        }

        if (
            overflowCursor < 1440
        ) {
            this.addSegment(
                track,
                overflowCursor,
                1440,
                "var(--background-modifier-border)",
                1,
                "Следующий день",
                true
            );
        }
    }

    private renderStatistics(
    scheduleMinutes: number,
    freeMinutes: number
    ): void {

        if (!this.data) {
            return;
        }


        // ----------------------------------------------
        // Заблокировано
        // ----------------------------------------------

        if (this.blockedStat) {

            this.blockedStat.textContent =
                formatDuration(
                    this.data.blockedMinutes
                );
        }


        // ----------------------------------------------
        // Задачи
        // ----------------------------------------------

        if (this.tasksStat) {

            this.tasksStat.textContent =
                formatDuration(
                    this.data.taskMinutes
                );
        }


        // ----------------------------------------------
        // Расписание
        // ----------------------------------------------

        if (
            this.scheduleStat &&
            this.scheduleLabel
        ) {

            this.scheduleStat.textContent =
                formatDuration(
                    scheduleMinutes
                );


            this.scheduleLabel.textContent =
                "расписание";


            if (
                this.data.scheduleAdjustment !== 0
            ) {

                this.scheduleLabel.createSpan({
                    cls:
                        "task-timeline-adjustment",
                    text:
                        ` (${
                            this.data
                                .scheduleAdjustment > 0
                                ? "+"
                                : ""
                        }${
                            formatDuration(
                                this.data
                                    .scheduleAdjustment
                            )
                        })`
                });
            }
        }


        // ----------------------------------------------
        // Свободно
        // ----------------------------------------------

        if (
            this.freeStat &&
            this.freeLabel
        ) {

            this.freeStat.textContent =
                formatDuration(
                    freeMinutes
                );


            this.freeStat.classList.toggle(
                "is-negative",
                freeMinutes < 0
            );


            this.freeLabel.textContent =
                "свободно";


            if (
                this.data.scheduleAdjustment !== 0
            ) {

                const adjustmentValue =
                    -this.data
                        .scheduleAdjustment;


                this.freeLabel.createSpan({
                    cls:
                        "task-timeline-adjustment",
                    text:
                        ` (${
                            adjustmentValue > 0
                                ? "+"
                                : ""
                        }${
                            formatDuration(
                                adjustmentValue
                            )
                        })`
                });
            }
        }
    }

    private addSegment(
        parent: HTMLElement,
        start: number,
        end: number,
        color: string,
        opacity: number,
        label: string,
        striped = false
    ): void {
        if (
            end <= start
        ) {
            return;
        }

        const left =
            Math.max(
                0,
                Math.min(
                    100,
                    start / 1440 * 100
                )
            );

        const width =
            Math.max(
                0,
                Math.min(
                    100 - left,
                    (end - start) /
                        1440 *
                        100
                )
            );

        if (
            width <= 0
        ) {
            return;
        }

        const element =
            parent.createDiv({
                cls:
                    "task-timeline-segment"
            });

        element.style.left =
            `${left}%`;

        element.style.width =
            `${width}%`;

        element.style.minWidth =
            `${MIN_SEGMENT_WIDTH}px`;

        element.style.background =
            striped
                ? this.createStripedBackground(
                    color
                )
                : color;

        element.style.opacity =
            String(opacity);

        element.setAttribute(
            "title",
            label
        );
    }

    private createStripedBackground(
        color: string
    ): string {
        return `
            repeating-linear-gradient(
                135deg,
                ${color},
                ${color} 5px,
                rgba(0,0,0,0.15) 5px,
                rgba(0,0,0,0.15) 9px
            )
        `;
    }

    private getTaskColor(
        index: number
    ): string {
        return TASK_COLORS[
            index %
                TASK_COLORS.length
        ];
    }

    private async saveAdjustment(
        value: number
    ): Promise<void> {
        const file =
            this.app.vault.getFileByPath(
                this.sourcePath
            );

        if (!file) {
            throw new Error(
                "Текущий файл не найден."
            );
        }

        const content =
            await this.app.vault.read(
                file
            );

        const pattern =
            new RegExp(
                `%%\\s*${escapeRegExp(
                    ADJUSTMENT_MARKER
                )}\\s*:\\s*-?\\d+\\s*%%`,
                "i"
            );

        let updated: string;

        if (
            value === 0
        ) {
            updated =
                content.replace(
                    pattern,
                    ""
                );
        } else {
            const replacement =
                `%%${ADJUSTMENT_MARKER}:${Math.round(
                    value
                )}%%`;

            if (
                pattern.test(content)
            ) {
                updated =
                    content.replace(
                        pattern,
                        replacement
                    );
            } else {
                updated =
                    content.trimEnd() +
                    `\n\n${replacement}\n`;
            }
        }

        if (
            updated !== content
        ) {
            await this.app.vault.modify(
                file,
                updated
            );
        }
    }

    private openAdjustmentModal(): void {
        if (!this.data) {
            return;
        }

        this.modal?.close?.();

        this.modal =
            new AdjustmentModal(
                this.app,
                this.data.scheduleAdjustment,
                async value => {
                    await this.saveAdjustment(
                        value
                    );

                    if (this.data) {
                        this.data
                            .scheduleAdjustment =
                            value;

                        this.updateUI();
                    }
                }
            );

        this.modal.open();
    }

    private showError(
        message: string
    ): void {
        if (!this.root) {
            return;
        }

        this.root.empty();

        const error =
            this.root.createDiv({
                cls:
                    "task-timeline-error",
                text:
                    `Task Timeline: ${message}`
            });

        error.setAttribute(
            "role",
            "alert"
        );
    }
}

function escapeRegExp(
    value: string
): string {
    return value.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}