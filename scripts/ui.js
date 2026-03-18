import { DOM } from "./dom.js";
import { savePopupState } from "./manageState.js";

/**
 * edits the button div to have a "success" UI.
 * @param {Object} timezone a time zone object from the user location
 */
export function applyTimezoneUI(timezone) {
    DOM.timezoneDiv.textContent = timezone.zoneName;
    DOM.timezoneDiv.classList.add("success");
    DOM.locationButton.classList.remove("loading");
    DOM.locationButton.textContent = "Location Retrieved";
    savePopupState();
}

/**
 * updates the copy paste text area to have the trash icon.
 * @returns nothing if the wrapper is null
 */
export function updateCopyPasteClearButton() {
    if (!DOM.copyPasteWrapper) return;

    const hasText = DOM.copyPasteInput.value.trim().length > 0;
    DOM.copyPasteWrapper.classList.toggle("hasText", hasText);
}

/**
 * clears the input of the copy paste text area.
 */
export function clearCopyPasteInput() {
    DOM.copyPasteInput.value = "";
    updateCopyPasteClearButton();
    savePopupState();
    DOM.copyPasteInput.focus();
}

/**
 * sets up the picker for the time in converting time zones.
 */
export function setupTimePickerOptions() {
    for (let i = 1; i <= 12; i++) {
        const opt = document.createElement("option");
        opt.value = String(i).padStart(2, "0");
        opt.textContent = opt.value;
        DOM.hourPicker.appendChild(opt);
    }

    for (let i = 0; i < 60; i += 5) {
        const opt = document.createElement("option");
        opt.value = String(i).padStart(2, "0");
        opt.textContent = opt.value;
        DOM.minutePicker.appendChild(opt);
    }
}

// limitation: if you convert time at exactly where DST is affected and you did not quit/restart the extension session, it will still presume DST and vice versa.
// to limit free API calls ^^^^
/**
 * converts the time from the source zone to the target zone.
 * @returns nothing if either sources are not valid
 */
export function convertTime() {
    try {
        // ensure zones are selected
        if (!DOM.sourceZoneValue.value || !DOM.targetZoneValue.value) {
            DOM.convertOutput.textContent = "Please select both timezones.";
            return;
        }

        // parse inputs
        const sourceData = JSON.parse(DOM.sourceZoneValue.value);
        const targetData = JSON.parse(DOM.targetZoneValue.value);
        let hour = Number(DOM.hourPicker.value);
        const minute = Number(DOM.minutePicker.value);

        // normalize to 24-hour minutes (0 to 1439)
        if (DOM.ampmPicker.value === "PM" && hour !== 12) hour += 12;
        if (DOM.ampmPicker.value === "AM" && hour === 12) hour = 0;
        
        let currentTotalMinutes = (hour * 60) + minute;

        let sourceOffset = sourceData.gmtOffset;
        let targetOffset = targetData.gmtOffset;

        // if your data includes a DST flag (0 or 1)
        if (sourceData.dst === 1) sourceOffset += 3600;
        if (targetData.dst === 1) targetOffset += 3600;

        const offsetDiffMinutes = (targetOffset - sourceOffset) / 60;
        let targetTotalMinutes = currentTotalMinutes + offsetDiffMinutes;

        // determine Day Shift (-1, 0, or 1)
        // Math.floor handles negative numbers correctly for 'previous day'
        const dayShift = Math.floor(targetTotalMinutes / 1440);
        const dayLabels = { "-1": " (previous day)", "0": "", "1": " (next day)" };

        // wrap minutes to stay within a 24-hour loop (0-1439)
        const finalMinutes = ((targetTotalMinutes % 1440) + 1440) % 1440;

        // format Output (12-hour clock)
        const h24 = Math.floor(finalMinutes / 60);
        const m = String(finalMinutes % 60).padStart(2, "0");
        const ampm = h24 >= 12 ? "PM" : "AM";
        const h12 = (h24 % 12) || 12; // If 0, result is 12

        let UTCDisplacementSource = Math.floor(sourceData.gmtOffset / 3600);
        let UTCDisplacementTarget = Math.floor(targetData.gmtOffset / 3600);

        if(UTCDisplacementSource >= 0) {
            UTCDisplacementSource = "+" + UTCDisplacementSource;
        }
        if(UTCDisplacementTarget >= 0) {
            UTCDisplacementTarget = "+" + UTCDisplacementTarget;
        }

        DOM.convertOutput.innerHTML = `From: UTC${UTCDisplacementSource} to UTC${UTCDisplacementTarget} <br> ${h12}:${m} ${ampm}${dayLabels[dayShift] || ""}`;
        savePopupState();
    } catch (err) {
        console.error("Conversion failed:", err);
        DOM.convertOutput.textContent = "Error parsing timezone data.";
    }
}

/**
 * clears the time zone picker
 * @param {Element} inputEl an input tag for the user to search and place their queries in
 * @param {Element} hiddenEl a hidden input tag for storing values
 * @param {Element} listEl a div tag for displaying a list of time zones
 */
export function clearTimezonePicker(inputEl, hiddenEl, listEl) {
    inputEl.value = "";
    hiddenEl.value = "";
    listEl.innerHTML = "";
    listEl.classList.remove("show");

    savePopupState();
    inputEl.focus();
}
