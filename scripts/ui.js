import { DOM } from "./dom.js";
import { savePopupState } from "./manageState.js";
import { getHoursAndMinutes, extractTimeParts, sanitizeTimeInput } from "./copyPasteConverter.js";
import { timezoneOffsets } from "./timezoneOffsets.js";
import { storageLocal } from "./storage.js";

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
 * updates the copy paste text area to have the trash icon.
 * @returns {void} nothing if the wrapper is null
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
 * determines if the time given is in its standard format (i.e. HH:MM (AM/PM))
 * @param {string} str a string time format
 * @returns {} hours and minutes if it is a valid time format
 */
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

        let UTCDisplacementSource = sourceOffset / 3600;
        let UTCDisplacementTarget = targetOffset / 3600;

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

/**
 * clears a time zone input
 * @param {*} el element
 */
export function clearTimeInput(el) {
    el.value = "";

    savePopupState();
    el.focus();
}

/**
 * initializes the extension toggle and adds a change listener that updates UI state, saves it, and applies the toggle behavior to the current tab.
 * immediate action for the toggle on/off
 */
export function setupExtensionToggle() {
    if (!DOM.extensionToggle) return;

    DOM.extensionToggle.addEventListener("change", async () => {
        const enabled = DOM.extensionToggle.checked;

        try {
            const { timezone_now } = await storageLocal.get("timezone_now");

            // handle not getting time zone yet
            if (enabled && !timezone_now) {
                DOM.extensionToggle.checked = false;

                if (DOM.toggleStatusText) {
                    DOM.toggleStatusText.textContent = "OFF";
                    DOM.toggleStatusText.style.color = "#94a3b8";
                }

                if (DOM.toggleErrorText) {
                    DOM.toggleErrorText.textContent = "Get your time zone first from the Paste & Convert tab!";
                    DOM.toggleErrorText.classList.remove("hidden");
                }

                await savePopupState();
                return;
            }

            if (DOM.toggleErrorText) {
                DOM.toggleErrorText.textContent = "";
                DOM.toggleErrorText.classList.add("hidden");
            }

            await savePopupState();

            if (DOM.toggleStatusText) {
                DOM.toggleStatusText.textContent = enabled ? "ON" : "OFF";
                DOM.toggleStatusText.style.color = enabled ? "#22c55e" : "#94a3b8";
            }

            // chrome.tabs.query returns an array of matching tabs.
            // destructuring ([tab]) extracts the first (active) tab object.
            const [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true
            });

            // restrictions
            if (
                !tab?.id ||
                !tab.url ||
                tab.url.startsWith("chrome://") ||
                tab.url.startsWith("edge://") ||
                tab.url.startsWith("about:") ||
                tab.url.startsWith("chrome-extension://") ||
                tab.url.startsWith("https://chromewebstore.google.com/") ||
                tab.url.startsWith("https://chrome.google.com/webstore/")
            ) {
                console.log("Cannot sync this tab.");
                return;
            }

            // the content script is declared in manifest.json and loaded by Chrome.
            await chrome.tabs.sendMessage(tab.id, {
                type: "TIME_EXTENSION_SET_OFFSETS",
                offsets: timezoneOffsets
            });

            // send extension toggle
            await chrome.tabs.sendMessage(tab.id, {
                type: "TIME_EXTENSION_TOGGLE",
                enabled
            });

            console.log(`Page toggle sent: ${enabled ? "ON" : "OFF"}`);
        } catch (error) {
            if (error?.message?.includes("Receiving end does not exist")) {
                console.log("Content script is not loaded in this tab yet. Reload the page and try again.");
                return;
            }

            console.error("Immediate popup sync failed:", error);
        }
    });
}
