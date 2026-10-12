import {
    App,
    PluginSettingTab,
    Setting
} from "obsidian";

import {
    FilePathSuggest
} from "./suggest";


export type SchedulePreset =
    | "5/2"
    | "2/2"
    | "3/3"
    | "custom";


export interface TaskTimelineSettings {
    weekdaySchedulePath: string;
    weekendSchedulePath: string;

    schedulePreset: SchedulePreset;

    cycleStartDate: string;

    customCycle: boolean[];
}


export const DEFAULT_SETTINGS:
    TaskTimelineSettings = {

        weekdaySchedulePath:
            "",

        weekendSchedulePath:
            "",

        schedulePreset:
            "5/2",

        cycleStartDate:
            "",

        customCycle: [
            true,
            true,
            false,
            false
        ]
    };


export class TaskTimelineSettingTab
    extends PluginSettingTab {

    private readonly plugin: {
        settings: TaskTimelineSettings;

        saveSettings:
            () => Promise<void>;
    };


    constructor(
        app: App,
        plugin: {
            settings: TaskTimelineSettings;

            saveSettings:
                () => Promise<void>;
        }
    ) {
        super(app, plugin);

        this.plugin =
            plugin;
    }


    display(): void {

        const {
            containerEl
        } = this;

        containerEl.empty();


        containerEl.createEl(
            "h2",
            {
                text:
                    "Task Timeline"
            }
        );


        // ==================================================
        // Расписание
        // ==================================================

        this.addPathSetting(
            containerEl,
            "Расписание рабочего дня",
            "Путь к заметке с расписанием рабочего дня.",
            "weekdaySchedulePath"
        );


        this.addPathSetting(
            containerEl,
            "Расписание выходного дня",
            "Путь к заметке с расписанием выходного дня.",
            "weekendSchedulePath"
        );


        // ==================================================
        // График
        // ==================================================

        containerEl.createEl(
            "h3",
            {
                text:
                    "График работы"
            }
        );


        this.addSchedulePresetSetting(
            containerEl
        );


        this.addCycleStartSetting(
            containerEl
        );


        this.addWeekPreview(
            containerEl
        );


        if (
            this.plugin.settings
                .schedulePreset ===
            "custom"
        ) {

            this.addCustomCycleEditor(
                containerEl
            );
        }
    }


    // ==================================================
    // Пути к расписанию
    // ==================================================

    private addPathSetting(
        container: HTMLElement,
        name: string,
        description: string,
        key:
            | "weekdaySchedulePath"
            | "weekendSchedulePath"
    ): void {

        const setting =
            new Setting(container)
                .setName(name)
                .setDesc(description);


        setting.addText(text => {

            text
                .setPlaceholder(
                    this.getPlaceholder(
                        key
                    )
                )
                .setValue(
                    this.plugin.settings[key]
                );


            let lastSavedValue =
                this.plugin.settings[key];


            const saveValue =
                async (): Promise<void> => {

                    const value =
                        text.inputEl.value.trim();


                    if (
                        value ===
                        lastSavedValue
                    ) {
                        return;
                    }


                    lastSavedValue =
                        value;


                    this.plugin.settings[key] =
                        value;


                    await this.plugin
                        .saveSettings();
                };


            text.inputEl.addEventListener(
                "blur",
                () => {
                    void saveValue();
                }
            );


            text.inputEl.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key === "Enter"
                    ) {

                        event.preventDefault();

                        void saveValue();

                        text.inputEl.blur();
                    }
                }
            );


            new FilePathSuggest(
                this.app,
                text.inputEl,
                async value => {

                    const normalized =
                        value.trim();


                    if (
                        normalized ===
                        lastSavedValue
                    ) {
                        return;
                    }


                    lastSavedValue =
                        normalized;


                    this.plugin.settings[key] =
                        normalized;


                    await this.plugin
                        .saveSettings();
                }
            );
        });
    }


    private getPlaceholder(
        key:
            | "weekdaySchedulePath"
            | "weekendSchedulePath"
    ): string {

        return key ===
            "weekdaySchedulePath"

            ? "Планирование/Расписание/Будний"

            : "Планирование/Расписание/Выходной";
    }


    // ==================================================
    // Тип графика
    // ==================================================

    private addSchedulePresetSetting(
        container: HTMLElement
    ): void {

        new Setting(container)
            .setName(
                "Тип графика"
            )
            .setDesc(
                "Выберите готовый график или создайте собственный цикл."
            )
            .addDropdown(
                dropdown => {

                    dropdown
                        .addOption(
                            "5/2",
                            "5 / 2"
                        )
                        .addOption(
                            "2/2",
                            "2 / 2"
                        )
                        .addOption(
                            "3/3",
                            "3 / 3"
                        )
                        .addOption(
                            "custom",
                            "Произвольный"
                        )
                        .setValue(
                            this.plugin.settings
                                .schedulePreset
                        )
                        .onChange(
                            async value => {

                                const preset =
                                    value as SchedulePreset;


                                this.plugin.settings
                                    .schedulePreset =
                                    preset;


                                // --------------------------------------------------
                                // При выборе циклического графика дата начала
                                // должна быть известна.
                                //
                                // Если её нет — автоматически ставим сегодня.
                                // --------------------------------------------------

                                if (
                                    (
                                        preset ===
                                        "2/2" ||
                                        preset ===
                                        "3/3" ||
                                        preset ===
                                        "custom"
                                    ) &&
                                    !this.plugin.settings
                                        .cycleStartDate
                                ) {

                                    this.plugin.settings
                                        .cycleStartDate =
                                        this.getTodayISO();
                                }


                                // --------------------------------------------------
                                // Заготовки пресетов
                                // --------------------------------------------------

                                if (
                                    preset ===
                                    "5/2"
                                ) {

                                    this.plugin.settings
                                        .customCycle = [
                                            true,
                                            true,
                                            true,
                                            true,
                                            true,
                                            false,
                                            false
                                        ];

                                } else if (
                                    preset ===
                                    "2/2"
                                ) {

                                    this.plugin.settings
                                        .customCycle = [
                                            true,
                                            true,
                                        false,
                                        false
                                    ];

                                } else if (
                                    preset ===
                                    "3/3"
                                ) {

                                    this.plugin.settings
                                        .customCycle = [
                                            true,
                                            true,
                                            true,
                                            false,
                                            false,
                                            false
                                        ];
                                }


                                await this.plugin
                                    .saveSettings();


                                // Полностью перерисовываем
                                // страницу настроек.
                                //
                                // Это нужно для того, чтобы
                                // предпросмотр сразу показывал
                                // выбранный график.

                                this.display();
                            }
                        );
                }
            );
    }


    // ==================================================
    // Дата начала цикла
    // ==================================================

    private addCycleStartSetting(
    container: HTMLElement
    ): void {

        new Setting(container)
            .setName(
                "Начало цикла"
            )
            .setDesc(
                "Дата первого дня цикла."
            )
            .addText(
                text => {

                    text.inputEl.type =
                        "date";

                    text
                        .setValue(
                            this.plugin.settings
                                .cycleStartDate
                        )
                        .onChange(
                            async value => {

                                this.plugin.settings
                                    .cycleStartDate =
                                    value.trim();

                                await this.plugin
                                    .saveSettings();

                                this.display();
                            }
                        );
                }
            );
    }


    // ==================================================
    // Предпросмотр текущей недели
    // ==================================================

    private addWeekPreview(
    container: HTMLElement
    ): void {

        const setting =
            new Setting(container)
                .setName(
                    "Текущая неделя"
                );


        setting.settingEl.addClass(
            "task-timeline-week-setting"
        );


        const preview =
            setting.controlEl.createDiv({
                cls:
                    "task-timeline-week-preview"
            });


        const today =
            new Date();

        today.setHours(
            0,
            0,
            0,
            0
        );


        const currentDay =
            today.getDay();

        const mondayOffset =
            currentDay === 0
                ? -6
                : 1 - currentDay;


        const monday =
            new Date(today);


        monday.setDate(
            monday.getDate() +
            mondayOffset
        );


        const dayNames = [
            "Пн",
            "Вт",
            "Ср",
            "Чт",
            "Пт",
            "Сб",
            "Вс"
        ];


        for (
            let i = 0;
            i < 7;
            i++
        ) {

            const date =
                new Date(monday);


            date.setDate(
                monday.getDate() +
                i
            );


            const isWorkDay =
                this.isWorkDay(
                    date
                );


            const day =
                preview.createDiv({
                    cls:
                        "task-timeline-week-day"
                });


            day.toggleClass(
                "is-workday",
                isWorkDay
            );


            day.toggleClass(
                "is-weekend",
                !isWorkDay
            );


            day.setText(
                dayNames[i]
            );
        }
    }


    // ==================================================
    // Произвольный цикл
    // ==================================================

    private addCustomCycleEditor(
        container: HTMLElement
    ): void {

        const setting =
            new Setting(container)
                .setName(
                    "Цикл"
                )
                .setDesc(
                    "Нажмите на день, чтобы переключить его состояние."
                );


        const editor =
            setting.settingEl.createDiv({
                cls:
                    "task-timeline-cycle-editor"
            });


        const cycle =
            this.plugin.settings
                .customCycle;


        if (
            cycle.length === 0
        ) {

            this.plugin.settings
                .customCycle = [
                    true
                ];
        }


        this.plugin.settings
            .customCycle
            .forEach(
                (isWorkDay, index) => {

                    this.createCycleDay(
                        editor,
                        index,
                        isWorkDay
                    );
                }
            );


        const addButton =
            editor.createEl(
                "button",
                {
                    text:
                        "+"
                }
            );


        addButton.addClass(
            "task-timeline-cycle-add"
        );


        addButton.addEventListener(
            "click",
            async () => {

                this.plugin.settings
                    .customCycle
                    .push(true);


                await this.plugin
                    .saveSettings();


                this.display();
            }
        );
    }


    private createCycleDay(
        container: HTMLElement,
        index: number,
        isWorkDay: boolean
    ): void {

        const day =
            container.createDiv({
                cls:
                    "task-timeline-cycle-day"
            });


        day.toggleClass(
            "is-workday",
            isWorkDay
        );


        day.toggleClass(
            "is-weekend",
            !isWorkDay
        );


        day.createDiv({
            cls:
                "task-timeline-cycle-number",
            text:
                String(
                    index + 1
                )
        });


        day.createDiv({
            cls:
                "task-timeline-cycle-status",
            text:
                isWorkDay
                    ? "Работа"
                    : "Выходной"
        });


        day.addEventListener(
            "click",
            async () => {

                this.plugin.settings
                    .customCycle[index] =
                    !this.plugin.settings
                        .customCycle[index];


                await this.plugin
                    .saveSettings();


                this.display();
            }
        );


        if (
            this.plugin.settings
                .customCycle.length > 1
        ) {

            const remove =
                day.createEl(
                    "button",
                    {
                        text:
                            "×"
                    }
                );


            remove.addClass(
                "task-timeline-cycle-remove"
            );


            remove.addEventListener(
                "click",
                async event => {

                    event.stopPropagation();


                    this.plugin.settings
                        .customCycle
                        .splice(
                            index,
                            1
                        );


                    await this.plugin
                        .saveSettings();


                    this.display();
                }
            );
        }
    }


    // ==================================================
    // Расчёт рабочего дня
    // ==================================================

    private isWorkDay(
        date: Date
    ): boolean {

        const cycle =
            this.getCycle();


        // Для 5/2 дата начала цикла
        // необязательна.

        if (
            this.plugin.settings
                .schedulePreset ===
            "5/2" &&
            !this.plugin.settings
                .cycleStartDate
        ) {

            const day =
                date.getDay();

            return (
                day !== 0 &&
                day !== 6
            );
        }


        const start =
            this.getCycleStartDate();


        if (!start) {

            // Сюда мы попадём только
            // при старой/неполной конфигурации.

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


        const cycleStart =
            new Date(start);

        cycleStart.setHours(
            0,
            0,
            0,
            0
        );


        const diff =
            Math.floor(
                (
                    current.getTime() -
                    cycleStart.getTime()
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


    private getCycle(): boolean[] {

        switch (
            this.plugin.settings
                .schedulePreset
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
                    this.plugin.settings
                        .customCycle.length > 0

                    ? this.plugin.settings
                        .customCycle

                    : [true]
                );
        }
    }


    private getCycleStartDate():
        Date | null {

        const value =
            this.plugin.settings
                .cycleStartDate;


        if (!value) {
            return null;
        }


        const date =
            new Date(
                `${value}T00:00:00`
            );


        return Number.isNaN(
            date.getTime()
        )
            ? null
            : date;
    }


    // ==================================================
    // Сегодня в формате YYYY-MM-DD
    // ==================================================

    private getTodayISO(): string {

        const date =
            new Date();


        const year =
            date.getFullYear();


        const month =
            String(
                date.getMonth() + 1
            ).padStart(
                2,
                "0"
            );


        const day =
            String(
                date.getDate()
            ).padStart(
                2,
                "0"
            );


        return (
            `${year}-${month}-${day}`
        );
    }
}
