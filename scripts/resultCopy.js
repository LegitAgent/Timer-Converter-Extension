/**
 * renders a successful result with a copy button inside the output element.
 * @param {HTMLElement} outputEl result container
 * @param {string} convertedText converted text to display and copy
 * @returns {void}
 */
export function renderCopyableResult(outputEl, convertedText) {
    if (!outputEl) return;

    const text = document.createElement("span");
    text.className = "copyResultText";
    text.textContent = convertedText;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "copyResultBtn unselectable";
    button.setAttribute("aria-label", "Copy converted time");
    button.title = "Copy converted time";
    button.dataset.copyValue = convertedText;

    const icon = document.createElement("img");
    icon.src = "/images/copypaste.svg";
    icon.alt = "";
    icon.className = "copyResultIcon";

    button.appendChild(icon);

    outputEl.innerHTML = "";
    outputEl.classList.add("copyableResult");
    outputEl.append(text, button);
}

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
