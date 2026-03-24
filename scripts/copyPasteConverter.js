import { DOM } from "./dom.js";
import { savePopupState } from "./manageState.js";
import { storageLocal } from "./storage.js";
import { timezoneOffsets } from "./timezoneOffsets.js";
import { extractTimeParts, getHoursAndMinutes, convertToLocal } from "./timeConversion.js";

/**
 * sanitizes user input by removing control characters, such as /, <, >, and etc.
 * @param {string} input string user time input
 * @returns sanitized user input
 */
export function sanitizeTimeInput(input) {
    if (typeof input !== "string") return "";

    // this automatically blocks < > " ' ` and all control characters.
    let clean = input.replace(/[^a-zA-Z0-9\s:./+_\-]/g, "");

    // limit length (Time strings are rarely over 50 chars)
    clean = clean.trim().slice(0, 100);
    return clean;
}

export { extractTimeParts, getHoursAndMinutes, convertToLocal } from "./timeConversion.js";

// STANDARD FORMAT: TIME [AM/PM] TIMEZONE
/**
 * puts the sections in standard format (TIME, [AM/PM (optional)], TIMEZONE)
 * @param {string} str user time input
 * @returns map of user input sections: (time: Time, ampm: AM/PM, tz: timezone)
 */
function getStandardFormat(str) {
    const regex = /^(?<time>\S+)(?:\s+(?<ampm>\S+))?\s+(?<tz>\S+)$/i;
    const match = str.trim().match(regex);

    if (!match) return false;

    let { time, ampm, tz } = match.groups;

    const parts = extractTimeParts(time, ampm);

    return {
        time: parts.time,
        ampm: parts.ampm,
        tz: tz.toUpperCase()
    };
}

// REVERSE FORMAT: TIMEZONE TIME [AM/PM]
/**
 * puts the sections in reverse format (TIMEZONE, TIME, [AM/PM (optional)])
 * @param {string} str user time input
 * @returns a map of user input sections: (time: Time, ampm: AM/PM, tz: timezone)
 */
function getReverseFormat(str) {
    const regex = /^(?<tz>\S+)\s+(?<time>\S+)(?:\s+(?<ampm>\S+))?$/i;
    const match = str.trim().match(regex);

    if (!match) return false;

    let { tz, time, ampm } = match.groups;

    const parts = extractTimeParts(time, ampm);

    return {
        time: parts.time,
        ampm: parts.ampm,
        tz: tz.toUpperCase()
    };
}

/**
 * checks to see if a specific time zone abbreviation is in timezoneOffsets.
 * @param {string} tz a time zone abbreviation (e.g. PST, CEST, CET, etc.)
 * @returns {Boolean} if the time zone has the inputted abbreviation
 */
function isValidTimezone(tz) {
    return Object.hasOwn(timezoneOffsets, tz);
}
/**
 * checks to see if the input is a valid AM/PM format.
 * @param {string} ampm a string for the ampm section
 * @returns {Boolean} if the given string is in valid AM/PM format
 */
export function isValidAMPM(ampm) {
    if (ampm === undefined) return true;
    return ampm === "AM" || ampm === "PM";
}

/**
 * checks if the given time and ampm format is a valid format.
 * @param {string} time a string for the time section
 * @param {string} ampm a string for the ampm section
 * @returns 
 */
export function isValidTime(time, ampm) {
    return !!getHoursAndMinutes(time, ampm); // !! == truthy if != undefined, else falsy
}

/**
 * checks to see if a given Object is valid.
 * @param {Object} map an Object with keys = {tz, ampm, time}
 * @returns if the given Object has valid formatting for each key, if not return an array that indicates how soon it was wrong compared to standard format, higher = likely standard format
 */
function isValid(map) {
    const validTime = isValidTime(map.time, map.ampm);
    if (!validTime) return [false, 1];

    const validAMPM = isValidAMPM(map.ampm);
    if (!validAMPM) return [false, 2];

    const validTimezone = isValidTimezone(map.tz);
    if (!validTimezone) return [false, 3];

    return [true, 0];
}

/**
 * checks for which error occured.
 * @param {*} idx the index error message
 */
function errorMessage(idx) {
    if (idx == 1) {
        DOM.copyPasteOutput.innerHTML = "<b>Invalid time or invalid time format.</b>";
    } else if (idx == 2) {
        DOM.copyPasteOutput.innerHTML = "<b>Invalid AM/PM format.</b>";
    } else if (idx == 3) {
        DOM.copyPasteOutput.innerHTML = "<b>Invalid time zone.</b>";
    } else { // default
        DOM.copyPasteOutput.innerHTML = "Error"
    }

    return 1;
}

/**
 * converts the pasted time in to the user's local time.
 * @returns errors, if any
 */
export async function convertPastedTime() {
    const { timezone_now } = await storageLocal.get("timezone_now");
    if (!timezone_now) {
        DOM.copyPasteOutput.textContent = "Get your time zone first!";
        return;
    }
    
    try {
        const sanitizedText = sanitizeTimeInput(DOM.copyPasteInput.value);
        const isStandard = getStandardFormat(sanitizedText);
        const isReverse = getReverseFormat(sanitizedText);

        let validMap = isStandard || isReverse;

        if (!validMap) {
            DOM.copyPasteOutput.innerHTML = "Invalid format, use format:<br> <b>(00:00) (AM/PM optional) (time zone)</b> <br> or <br> <b>(time zone) (00:00) (AM/PM optional)</b>";
            savePopupState();
            return false;
        }

        const validStandard = isValid(isStandard);
        const validReverse = isValid(isReverse);

        if (validStandard[0]) {
            validMap = isStandard;
            const convertedTime = convertToLocal(validMap, timezone_now);
            DOM.copyPasteOutput.innerHTML = `${convertedTime}`;
        } else if (validReverse[0]) {
            validMap = isReverse;
            const convertedTime = convertToLocal(validMap, timezone_now);
            DOM.copyPasteOutput.innerHTML = `${convertedTime}`;
        } else {
            const moreLikely = validStandard[1] > validReverse[1] ? validStandard[1] : validReverse[1];
            errorMessage(moreLikely);
        }

        savePopupState();
        return 1;
    } catch (error) {
        console.error(error);
    }
}
