import {
    AbstractInputSuggest,
    App
} from "obsidian";

export class FilePathSuggest
    extends AbstractInputSuggest<string> {

    private readonly paths: string[];

    private readonly onSelect:
        (value: string) => void;


    constructor(
        app: App,
        inputEl: HTMLInputElement,
        onSelect: (value: string) => void
    ) {
        super(app, inputEl);

        this.limit = 100;

        this.onSelect =
            onSelect;

        this.paths =
            app.vault
                .getMarkdownFiles()
                .map(
                    file =>
                        file.path.replace(
                            /\.md$/i,
                            ""
                        )
                )
                .sort(
                    (a, b) =>
                        a.localeCompare(
                            b,
                            "ru"
                        )
                );
    }


    protected getSuggestions(
        query: string
    ): string[] {

        const normalized =
            query
                .trim()
                .toLocaleLowerCase("ru");


        if (!normalized) {

            return this.paths.slice(
                0,
                50
            );
        }


        return this.paths
            .filter(
                path =>
                    path
                        .toLocaleLowerCase("ru")
                        .includes(
                            normalized
                        )
            )
            .slice(
                0,
                100
            );
    }


    renderSuggestion(
        value: string,
        el: HTMLElement
    ): void {

        el.setText(value);
    }


    selectSuggestion(
        value: string,
        _evt: MouseEvent | KeyboardEvent
    ): void {

        this.setValue(value);

        this.onSelect(value);

        this.close();
    }
}