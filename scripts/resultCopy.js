/**
 * removes copy-button styling from an output element.
 * @param {HTMLElement} outputEl result container
 * @returns {void}
 */
export function resetCopyableResult(outputEl) {
    if (!outputEl) return;
    outputEl.classList.remove("copyableResult");
}

/**
 * initializes delegated copy-button handling for one result element.
 * @param {HTMLElement} outputEl result container
 * @returns {void}
 */
export function initializeCopyResult(outputEl) {
    if (!outputEl) return;

    outputEl.addEventListener("click", async (event) => {
        const button = event.target.closest(".copyResultBtn");
        if (!button || !outputEl.contains(button)) return;

        const copyValue = button.dataset.copyValue;
        if (!copyValue) return;

        try {
            await navigator.clipboard.writeText(copyValue);
            button.classList.remove("copied");
            void button.offsetWidth;
            button.classList.add("copied");
            button.title = "Copied";

            window.setTimeout(() => {
                button.classList.remove("copied");
                button.title = "Copy Output";
            }, 950);
        } catch (error) {
            console.error("Failed to copy converted time:", error);
        }
    });
}
