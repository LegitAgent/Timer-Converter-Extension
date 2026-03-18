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
                cachedHour: DOM.hourPicker.value,
                cachedMinute: DOM.minutePicker.value,
                cachedAMPM: DOM.ampmPicker.value,
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

        if(popupState.windowID) {
            DOM.windowID = popupState.windowID;
        }

        if (popupState.cachedCopyPasteInput) {
            DOM.copyPasteInput.value = popupState.cachedCopyPasteInput;
        }

        if(popupState.cachedSourceZoneInput && popupState.cachedSourceZoneValue) {
            DOM.sourceZoneInput.value = popupState.cachedSourceZoneInput;
            DOM.sourceZoneValue.value = popupState.cachedSourceZoneValue;
        }

        if(popupState.cachedTargetZoneInput && popupState.cachedTargetZoneValue) {
            DOM.targetZoneInput.value = popupState.cachedTargetZoneInput;
            DOM.targetZoneValue.value = popupState.cachedTargetZoneValue;
        }

        if(popupState.cachedHour && popupState.cachedMinute && popupState.cachedAMPM) {
            DOM.hourPicker.value = popupState.cachedHour;
            DOM.minutePicker.value = popupState.cachedMinute;
            DOM.ampmPicker.value = popupState.cachedAMPM;
        }

        if (popupState.timezoneOut) {
            DOM.timezoneDiv.textContent = popupState.timezoneOut;
        }

        if(popupState.cachedConvertOutput) {
            DOM.convertOutput.innerHTML = popupState.cachedConvertOutput;
        }
        updateCopyPasteClearButton();

        if(popupState.cachedCopyPasteOutput) {
            DOM.copyPasteOutput.innerHTML = popupState.cachedCopyPasteOutput;
        }

        if (popupState.tab) {
            const savedTabBtn = document.querySelector(`.navBtn[data-tab="${popupState.tab}"]`);
            savedTabBtn?.click();
        }

    } catch(error) {
        console.error("Failed to restore state:", error);
    }
}