import { DOM } from "./dom.js";
import { storageLocal, storageSession } from "./storage.js";
import { savePopupState, restoreState } from "./manageState.js";
import { applyTimezoneUI, updateCopyPasteClearButton, clearCopyPasteInput,
         convertTime, clearTimezonePicker, setupExtensionToggle, clearTimeInput } from "./ui.js";
import { getLocation, fetchTimezone, fetchTimezoneList } from "./api.js";
import { initCustomDropdowns } from "./timezonePicker.js";
import { setUpTabs } from "./tabs.js";
import { convertPastedTime } from "./copyPasteConverter.js";

/**
 * gets the location of the user, and updates the text content of #timezone to the user's local time zone
 */
async function handleLocationRequest() {    
    DOM.locationButton.classList.add("loading");
    DOM.locationButton.textContent = "Detecting...";

    try {
        const { latitude, longitude } = await getLocation();
        const { timezone_now, cached_lat, cached_lng } = await storageLocal.get(["timezone_now", "cached_lat", "cached_lng"]);

        // check if user is in the same spot (approx 100m)
        const isSameLocation = cached_lat !== undefined &&
                               cached_lng !== undefined &&
                               Math.abs(latitude - cached_lat) < 0.001 &&
                               Math.abs(longitude - cached_lng) < 0.001;

        if (timezone_now && isSameLocation) {
            applyTimezoneUI(timezone_now);
            console.log("Loaded time zone from cache");
        } else {
            console.log("Fetching from server...");
            const data = await fetchTimezone(latitude, longitude);
            applyTimezoneUI(data);
        }
    } catch (error) {
        DOM.locationButton.classList.remove("loading");
        DOM.locationButton.textContent = "Error";
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
