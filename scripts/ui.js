import { DOM } from "./dom.js";
import { savePopupState } from "./manageState.js";
import { getHoursAndMinutes, extractTimeParts, sanitizeTimeInput } from "./copyPasteConverter.js";

/**
 * edits the button div to have a "success" UI.
 * @param {Object} timezone a time zone object from the user location
 */
export function applyTimezoneUI(timezone) {
    DOM.timezoneOutput.textContent = timezone.zoneName;
    DOM.timezoneOutput.classList.add("success");
    DOM.locationButton.classList.remove("loading");
    DOM.locationButton.textContent = "Location Retrieved";
    savePopupState();
}

/**
 * checks if the element has any text or value in it, if it doesn;t, then hide it.
 * @param {*} el element to render
 * @param {*} text text to check
 */
export function renderOutput(el, text) {
    el.textContent = text || "";
    el.classList.toggle("hidden", !text || !text.trim());
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

function isStandard(str) {
    const regex = /^(?<time>\S+)(?:\s+(?<ampm>\S+))?$/i;
    const match = str.trim().match(regex);

    if (!match) return false;

    let { time, ampm } = match.groups;

    const parts = extractTimeParts(time, ampm);

    return {
        time: parts.time,
        ampm: parts.ampm,
    };
}

// limitation: if you convert time at exactly where DST is affected and you did not quit/restart the extension session, it will still presume DST and vice versa.
// to limit free API calls ^^^^
/**
 * converts the time from the source zone to the target zone.
 * @returns nothing if any of the sources are not valid
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

        const sanitizedText = sanitizeTimeInput(DOM.inputTimeConvert.value);
        let convertedTime = isStandard(sanitizedText);

        if (!convertedTime) {
            DOM.convertOutput.textContent = "Please enter a valid time. Format is: HH:MM AM/PM";
            return;
        }

        const parsedTime = getHoursAndMinutes(convertedTime.time, convertedTime.ampm);

        if (!parsedTime) {
            DOM.convertOutput.textContent = "Please enter a valid time. Format is: HH:MM AM/PM";
            return;
        }

        const {hours, minutes} = parsedTime;
        
        let currentTotalMinutes = (hours * 60) + minutes;

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
        const h12 = (h24 % 12) || 12; // if 0, result is 12

        let UTCDisplacementSource = sourceData.gmtOffset / 3600;
        let UTCDisplacementTarget = targetData.gmtOffset / 3600;

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
