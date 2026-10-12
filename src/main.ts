import {
    Plugin
} from "obsidian";

import {
    TaskTimelineView
} from "./timeline";

import {
    DEFAULT_SETTINGS,
    TaskTimelineSettings,
    TaskTimelineSettingTab
} from "./settings";


export default class TaskTimelinePlugin
    extends Plugin {

    settings:
        TaskTimelineSettings;

    private views =
        new Set<TaskTimelineView>();


    async onload(): Promise<void> {

        await this.loadSettings();


        this.addSettingTab(
            new TaskTimelineSettingTab(
                this.app,
                this
            )
        );


        this.registerMarkdownCodeBlockProcessor(
            "task-timeline",
            (_source, el, ctx) => {

                const view =
                    new TaskTimelineView(
                        this.app,
                        el,
                        ctx.sourcePath,
                        () =>
                            this.settings
                    );


                this.views.add(view);


                // Когда MarkdownRenderChild
                // выгружается, он сам должен
                // удалить себя из коллекции.

                view.setOnUnload(
                    () => {
                        this.views.delete(view);
                    }
                );


                ctx.addChild(view);
            }
        );
    }


    async loadSettings(): Promise<void> {

        this.settings =
            Object.assign(
                {},
                DEFAULT_SETTINGS,
                await this.loadData()
            );
    }


    async saveSettings(): Promise<void> {

        await this.saveData(
            this.settings
        );


        for (
            const view
            of this.views
        ) {
            view.refresh();
        }
    }
}