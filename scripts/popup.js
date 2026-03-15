// notes: UPDATE ID FOR CORS POLICY PROTECTION
import { DOM } from "./dom.js";
import { storageLocal, storageSession } from "./storage.js";
import { savePopupState, restoreState } from "./manageState.js";
import { applyTimezoneUI, updateCopyPasteClearButton, clearCopyPasteInput, setupTimePickerOptions,
         convertTime, clearTimezonePicker, convertPastedTime } from "./ui.js";
import { getLocation, fetchTimezone, fetchTimezoneList } from "./api.js";
import { initCustomDropdowns } from "./timezonePicker.js";
import { setUpTabs } from "./tabs.js";

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

function init() {
    setUpTabs();
    DOM.copyPasteInput.addEventListener("input", () => {
        updateCopyPasteClearButton();
        savePopupState();
    });
    DOM.clearCopyPasteButton?.addEventListener("click", clearCopyPasteInput);
    updateCopyPasteClearButton();
    
    DOM.locationButton.addEventListener("click", handleLocationRequest);

    DOM.hourPicker.addEventListener("change", savePopupState);
    DOM.minutePicker.addEventListener("change", savePopupState);
    DOM.ampmPicker.addEventListener("change", savePopupState);

    DOM.convertButton.addEventListener("click", convertTime);
    DOM.copyPasteConvertButton.addEventListener("click", convertPastedTime);

    DOM.clearSourceZoneButton?.addEventListener("click", () => {
        clearTimezonePicker(DOM.sourceZoneInput, DOM.sourceZoneValue, DOM.sourceZoneList);
    });

    DOM.clearTargetZoneButton?.addEventListener("click", () => {
        clearTimezonePicker(DOM.targetZoneInput, DOM.targetZoneValue, DOM.targetZoneList);
    });
    
    setupTimePickerOptions();

    handleTimezoneListRequest();
    restoreState();
}

document.addEventListener("DOMContentLoaded", init);
