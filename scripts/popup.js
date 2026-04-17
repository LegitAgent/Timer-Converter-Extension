import { DOM } from "./dom.js";
import { storageLocal, storageSession } from "./storage.js";
import { savePopupState, restoreState } from "./manageState.js";
import { applyTimezoneUI, updateCopyPasteClearButton, clearCopyPasteInput,
         convertTime, clearTimezonePicker, setupExtensionToggle, clearTimeInput, setupThemeToggle, applyPopupTheme } from "./ui.js";
import { getLocationWithFallback, getIntlFallbackTimezone, fetchTimezone, fetchTimezoneList } from "./api.js";
import { initCustomDropdowns } from "./timezonePicker.js";
import { setUpTabs } from "./tabs.js";
import { convertPastedTime } from "./copyPasteConverter.js";
import { initializeCopyResult } from "./resultCopy.js";

/**
 * gets the location of the user, and updates the text content of #timezone to the user's local time zone
 */
async function handleLocationRequest() {    
    if (DOM.locationButton.classList.contains("loading")) {
        return;
    }

    DOM.locationButton.classList.add("loading");
    DOM.locationButton.textContent = "Detecting...";
    DOM.timezoneOutput.classList.remove("success");

    try {
        const location = await getLocationWithFallback();
        const { timezone_now, cached_lat, cached_lng } = await storageLocal.get(["timezone_now", "cached_lat", "cached_lng"]);

        if (location) {
            const { latitude, longitude } = location;

            const isSameLocation = cached_lat !== undefined &&
                                   cached_lng !== undefined &&
                                   Math.abs(latitude - cached_lat) < 0.001 &&
                                   Math.abs(longitude - cached_lng) < 0.001;

            if (timezone_now && isSameLocation) {
                applyTimezoneUI(timezone_now);
                console.log("Loaded time zone from cache");
                return;
            }

            console.log("Fetching from server...");
            const data = await fetchTimezone(latitude, longitude);
            applyTimezoneUI(data);
            return;
        }

        // fallback to non-api call if geolocation is unavailable
        const intlTimezone = await getIntlFallbackTimezone();
        await storageLocal.set({ timezone_now: intlTimezone });
        applyTimezoneUI(intlTimezone);
        console.log("Geolocation timed out. Fell back to browser timezone.");
    } catch (error) {
        DOM.locationButton.classList.remove("loading");
        DOM.locationButton.textContent = "Try Again";
        DOM.timezoneOutput.classList.remove("success");
        DOM.timezoneOutput.textContent = error?.message || "Unable to detect timezone.";
        console.error(error);
    }
}

/**
 * gets the list of time zones from the API and initializes them as a list
 */
async function handleTimezoneListRequest() {
    try {
        let { timezone_list } = await storageSession.get("timezone_list");
        if (timezone_list != null) {
            console.log("Loaded time zone list from cache");
        } else {
            console.log("Fetching Timezone List from server");
            timezone_list = await fetchTimezoneList();
        }

        // API returns { status: "OK", message: "", zones: [...] }, unwrap the array
        const list = timezone_list?.zones ?? [];

        initCustomDropdowns(list);
    } catch(error) {
        console.error(error);
    }
}

/**
 * creates a window for instructions.html and stores the window ID.
 */
function createInstructionWindow() {
    chrome.windows.create({
        url: chrome.runtime.getURL("HTML/instructions.html"),
        type: "popup",
        width: 820,
        height: 760
    }, (window) => {
        DOM.windowID = window.id;
        savePopupState(); // sync to storage immediately
    });
}

/**
 * checks if the window removed was the windowID, if so set windowID to null.
 */
chrome.windows.onRemoved.addListener((closedId) => {
    if (closedId === DOM.windowID) {
        console.log("Manual window closed.");
        DOM.windowID = null; 
        savePopupState();
    }
});

/**
 * initialization of the popup
 */
async function init() {
    setUpTabs();
    applyPopupTheme(false);
    initializeCopyResult(DOM.copyPasteOutput);
    initializeCopyResult(DOM.convertOutput);

    DOM.copyPasteInput.addEventListener("input", () => {
        updateCopyPasteClearButton();
        savePopupState();
    });

    DOM.clearCopyPasteButton?.addEventListener("click", clearCopyPasteInput);
    updateCopyPasteClearButton();
    
    DOM.locationButton.addEventListener("click", handleLocationRequest);

    DOM.inputTimeConvert.addEventListener("change", savePopupState);

    DOM.convertButton.addEventListener("click", convertTime);
    DOM.copyPasteConvertButton.addEventListener("click", convertPastedTime);

    DOM.clearSourceZoneButton.addEventListener("click", () => {
        clearTimezonePicker(DOM.sourceZoneInput, DOM.sourceZoneValue, DOM.sourceZoneList);
    });

    DOM.clearTargetZoneButton.addEventListener("click", () => {
        clearTimezonePicker(DOM.targetZoneInput, DOM.targetZoneValue, DOM.targetZoneList);
    });

    DOM.clearTimeInputButton.addEventListener("click", () => {
        clearTimeInput(DOM.inputTimeConvert)
    })
    
    await handleTimezoneListRequest();
    await restoreState();

    setupThemeToggle();
    setupExtensionToggle();
    
    DOM.openManualIcon.addEventListener("click", () => {
        if (DOM.windowID) {
            // check if window still exists before focusing
            chrome.windows.get(DOM.windowID, (window) => {
                if (chrome.runtime.lastError || !window) {
                    DOM.windowID = null;
                    createInstructionWindow();
                } else {
                    chrome.windows.update(DOM.windowID, { focused: true });
                }
            });
            return;
        }
        createInstructionWindow();
    });
}

document.addEventListener("DOMContentLoaded", init);
