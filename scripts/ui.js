import { DOM } from "./dom.js";
import { savePopupState } from "./manageState.js";
import { timezoneOffsets } from "./timezoneOffsets.js";

export function applyTimezoneUI(timezone) {
    DOM.timezoneDiv.textContent = timezone.zoneName;
    DOM.timezoneDiv.classList.add("success");
    DOM.locationButton.classList.remove("loading");
    DOM.locationButton.textContent = "Location Retrieved";
    savePopupState();
}

export function updateCopyPasteClearButton() {
    if (!DOM.copyPasteWrapper) return;

    const hasText = DOM.copyPasteInput.value.trim().length > 0;
    DOM.copyPasteWrapper.classList.toggle("hasText", hasText);
}

export function clearCopyPasteInput() {
    DOM.copyPasteInput.value = "";
    updateCopyPasteClearButton();
    savePopupState();
    DOM.copyPasteInput.focus();
}

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

        // calculate offset (gmtOffset is usually in seconds, convert to minutes)
        const offsetDiffMinutes = (targetData.gmtOffset - sourceData.gmtOffset) / 60;
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

export function clearTimezonePicker(inputEl, hiddenEl, listEl) {
    inputEl.value = "";
    hiddenEl.value = "";
    listEl.innerHTML = "";
    listEl.classList.remove("show");

    savePopupState();
    inputEl.focus();
}

function sanitizeTimeInput(input) {
    if (typeof input !== "string") return "";

    // only allow characters found in times and timezone names:
    // numbers, colons, spaces, letters, slashes, plus/minus, and underscores.
    // this automatically blocks < > " ' ` and all control characters.
    let clean = input.replace(/[^a-zA-Z0-9\s:/+_\-]/g, "");

    // limit length (Time strings are rarely over 50 chars)
    clean = clean.trim().slice(0, 100);

    return clean;
}

export function convertPastedTime() {

    let sanitizedText = sanitizeTimeInput(DOM.copyPasteInput.value);

    console.log(sanitizedText); // test
}