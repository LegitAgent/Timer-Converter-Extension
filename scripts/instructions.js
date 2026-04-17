import { storageLocal } from "./storage.js";

/**
 * applies the saved popup theme to the instructions page
 * @param {boolean} lightModeEnabled whether light mode is active
 */
function applyInstructionsTheme(lightModeEnabled) {
    document.body.dataset.theme = lightModeEnabled ? "light" : "dark";
}

/**
 * restores the current saved theme when the instructions page opens
 */
async function restoreInstructionsTheme() {
    const { popupState } = await storageLocal.get("popupState");
    applyInstructionsTheme(Boolean(popupState?.lightModeEnabled));
}

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.popupState) return;

    const lightModeEnabled = Boolean(changes.popupState.newValue?.lightModeEnabled);
    applyInstructionsTheme(lightModeEnabled);
});

restoreInstructionsTheme();
