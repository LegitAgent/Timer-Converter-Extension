import { DOM } from "./dom.js";
import { storageLocal } from "./storage.js";
import { updateCopyPasteClearButton } from "./ui.js"

/**
 * saves the current state of the popup, and stores it to google local storage
 * @returns 
 */
export async function savePopupState() {
    try {
        const activeTab = document.querySelector(".navBtn.active")?.dataset.tab;
        
        await storageLocal.set({
            popupState: {
                windowID: DOM.windowID,
                tab: activeTab,
                cachedCopyPasteInput: DOM.copyPasteInput.value,
                timezoneOut: DOM.timezoneDiv.textContent,
                cachedSourceZoneInput: DOM.sourceZoneInput.value,
                cachedSourceZoneValue: DOM.sourceZoneValue.value,
                cachedTargetZoneInput: DOM.targetZoneInput.value,
                cachedTargetZoneValue: DOM.targetZoneValue.value,
                cachedInputTimeConvert: DOM.inputTimeConvert.value,
                cachedConvertOutput: DOM.convertOutput.innerHTML,
                cachedCopyPasteOutput: DOM.copyPasteOutput.innerHTML
            }
        });
    } catch(error) {
        console.error("Failed to save popup state:", error);
        return;
    }
}

/**
 * accesses google local storage, and retrieves all stored states of the popup
 * @returns 
 */
export async function restoreState() {
    try {
        const { popupState } = await storageLocal.get("popupState");
        if (!popupState) return;

        if(popupState.windowID != null) {
            DOM.windowID = popupState.windowID;
        }

        if (popupState.cachedCopyPasteInput != null) {
            DOM.copyPasteInput.value = popupState.cachedCopyPasteInput;
        }

        if(popupState.cachedSourceZoneInput != null && popupState.cachedSourceZoneValue != null) {
            DOM.sourceZoneInput.value = popupState.cachedSourceZoneInput;
            DOM.sourceZoneValue.value = popupState.cachedSourceZoneValue;
        }

        if(popupState.cachedTargetZoneInput != null && popupState.cachedTargetZoneValue != null) {
            DOM.targetZoneInput.value = popupState.cachedTargetZoneInput;
            DOM.targetZoneValue.value = popupState.cachedTargetZoneValue;
        }

        if(popupState.cachedInputTimeConvert != null) {
            DOM.inputTimeConvert.value = popupState.cachedInputTimeConvert;
        }

        if (popupState.timezoneOut != null) {
            DOM.timezoneDiv.textContent = popupState.timezoneOut;
        }

        if(popupState.cachedConvertOutput != null) {
            DOM.convertOutput.innerHTML = popupState.cachedConvertOutput;
        }
        updateCopyPasteClearButton();

        if(popupState.cachedCopyPasteOutput != null) {
            DOM.copyPasteOutput.innerHTML = popupState.cachedCopyPasteOutput;
        }

        if (popupState.tab != null) {
            const savedTabBtn = document.querySelector(`.navBtn[data-tab="${popupState.tab}"]`);
            savedTabBtn?.click();
        }

    } catch(error) {
        console.error("Failed to restore state:", error);
    }
}