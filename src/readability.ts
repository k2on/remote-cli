export const createReadabilityScript = (
    title: string,
    language: string,
    ignoreCharacter: '##' | 'REM',
): string => `window.addEventListener("load", () => {
    const $head = document.querySelector("head");
    const $body = document.querySelector("body");
    const script = $body.innerHTML.split("\\n");
    const content = script.reduce(
        (content, line) => {
            if (line.slice(0, 2) === "${ignoreCharacter}") {
                content.head.push(line.slice(2));
            } else {
                content.body.push(line);
            }
            return content;
        },
        { head: [], body: [] },
    );

    const code = Prism.highlight(
        content.body.join("\\n"),
        Prism.languages.${language},
        "${language}",
    );

    $body.innerHTML =
        "<pre class='language-${language}'><code class='language-${language}'>" +
        code +
        "</code></pre>";
    $head.innerHTML =
        "<title>${title}</title>" + content.head.join("\\n");
});`;
