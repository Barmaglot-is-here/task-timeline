import {
    App
} from "obsidian";

import {
    formatAdjustment,
    parseAdjustment
} from "./parser";

export class AdjustmentModal {
    private overlay:
        HTMLDivElement | null = null;

    private input:
        HTMLInputElement | null = null;

    private error:
        HTMLDivElement | null = null;

    private closing = false;

    private keydownHandler:
        ((event: KeyboardEvent) => void) | null = null;

    constructor(
        private readonly app: App,
        private readonly initialValue: number,
        private readonly onSave: (
            value: number
        ) => Promise<void>
    ) {}

    open(): void {
        if (this.overlay) {
            return;
        }

        this.create();
    }

    private create(): void {
        const overlay =
            document.createElement(
                "div"
            );

        overlay.className =
            "task-timeline-modal-overlay";

        const modal =
            document.createElement(
                "div"
            );

        modal.className =
            "task-timeline-modal";

        modal.innerHTML = `
            <div class="task-timeline-modal-title">
                Корректировка расписания
            </div>

            <div class="task-timeline-modal-description">
                Отрицательное значение уменьшает
                расписание и увеличивает свободное время.
            </div>

            <input
                class="task-timeline-adjustment-input"
                type="text"
                inputmode="text"
                autocomplete="off"
                spellcheck="false"
            >

            <div class="task-timeline-modal-hint">
                Примеры: -2:00, +1:30, 90, -90
            </div>

            <div class="task-timeline-presets">
                <button
                    type="button"
                    data-adjust="-60"
                >
                    −1 ч
                </button>

                <button
                    type="button"
                    data-adjust="-30"
                >
                    −30 мин
                </button>

                <button
                    type="button"
                    data-adjust="-15"
                >
                    −15 мин
                </button>

                <button
                    type="button"
                    data-adjust="15"
                >
                    +15 мин
                </button>

                <button
                    type="button"
                    data-adjust="30"
                >
                    +30 мин
                </button>

                <button
                    type="button"
                    data-adjust="60"
                >
                    +1 ч
                </button>
            </div>

            <div class="task-timeline-modal-error"></div>

            <div class="task-timeline-reset-row">
                <button
                    type="button"
                    class="task-timeline-reset-button"
                >
                    Сбросить
                </button>
            </div>
        `;

        overlay.appendChild(modal);

        document.body.appendChild(
            overlay
        );

        this.overlay = overlay;

        this.input =
            modal.querySelector(
                ".task-timeline-adjustment-input"
            );

        this.error =
            modal.querySelector(
                ".task-timeline-modal-error"
            );

        if (!this.input) {
            return;
        }

        this.input.value =
            formatAdjustment(
                this.initialValue
            );

        this.attachHandlers(
            overlay,
            modal
        );

        this.input.focus();
        this.input.select();
    }

    private attachHandlers(
        overlay: HTMLDivElement,
        modal: HTMLDivElement
    ): void {
        const input =
            this.input;

        if (!input) {
            return;
        }

        for (
            const button
            of modal.querySelectorAll<HTMLButtonElement>(
                "[data-adjust]"
            )
        ) {
            button.addEventListener(
                "click",
                () => {
                    const delta =
                        Number(
                            button.dataset.adjust
                        );

                    const current =
                        parseAdjustment(
                            input.value
                        );

                    input.value =
                        formatAdjustment(
                            current + delta
                        );

                    this.clearError();

                    input.focus();
                    input.select();
                }
            );
        }

        const resetButton =
            modal.querySelector<HTMLButtonElement>(
                ".task-timeline-reset-button"
            );

        resetButton?.addEventListener(
            "click",
            () => {
                input.value =
                    "0:00";

                this.clearError();

                input.focus();
                input.select();
            }
        );

        overlay.addEventListener(
            "click",
            event => {
                if (
                    event.target === overlay
                ) {
                    void this.closeAndSave();
                }
            }
        );

        input.addEventListener(
            "keydown",
            event => {
                if (
                    event.key === "Enter"
                ) {
                    event.preventDefault();
                    void this.closeAndSave();
                }
            }
        );

        this.keydownHandler =
            event => {
                if (
                    event.key === "Escape"
                ) {
                    void this.closeAndSave();
                }
            };

        document.addEventListener(
            "keydown",
            this.keydownHandler
        );
    }

    private async closeAndSave(): Promise<void> {
        if (
            this.closing ||
            !this.input
        ) {
            return;
        }

        const raw =
            this.input.value
                .trim()
                .replace(/\s+/g, "");

        if (!raw) {
            await this.save(
                0
            );

            return;
        }

        if (
            !isValidAdjustment(
                raw
            )
        ) {
            this.showError(
                "Некорректный формат. " +
                "Например: -2:00 или +90."
            );

            this.input.focus();
            this.input.select();

            return;
        }

        await this.save(
            parseAdjustment(raw)
        );
    }

    private async save(
        value: number
    ): Promise<void> {
        if (this.closing) {
            return;
        }

        this.closing = true;

        try {
            await this.onSave(
                value
            );

            this.destroy();
        } catch (error) {
            this.closing = false;

            const message =
                error instanceof Error
                    ? error.message
                    : String(error);

            this.showError(
                "Не удалось сохранить значение: " +
                message
            );
        }
    }

    private showError(
        message: string
    ): void {
        if (!this.error) {
            return;
        }

        this.error.textContent =
            message;

        this.error.classList.add(
            "is-visible"
        );
    }

    private clearError(): void {
        if (!this.error) {
            return;
        }

        this.error.textContent =
            "";

        this.error.classList.remove(
            "is-visible"
        );
    }

    private destroy(): void {
        if (
            this.keydownHandler
        ) {
            document.removeEventListener(
                "keydown",
                this.keydownHandler
            );
        }

        this.keydownHandler =
            null;

        this.overlay?.remove();

        this.overlay =
            null;

        this.input =
            null;

        this.error =
            null;
    }
}

function isValidAdjustment(
    value: string
): boolean {
    return /^([+-])?\d+(?::[0-5]\d)?$/.test(
        value
    );
}