import { DOM } from "./dom.js";
import { savePopupState } from "./manageState.js";
import { storageLocal } from "./storage.js";
import { timezoneOffsets } from "./timezoneOffsets.js";

/**
 * sanitizes user input by removing control characters, such as /, <, >, and etc.
 * @param {string} input string user time input
 * @returns sanitized user input
 */
export function sanitizeTimeInput(input) {
    if (typeof input !== "string") return "";

    // this automatically blocks < > " ' ` and all control characters.
    let clean = input.replace(/[^a-zA-Z0-9\s:/+_\-]/g, "");

    // limit length (Time strings are rarely over 50 chars)
    clean = clean.trim().slice(0, 100);
    return clean;
}

/**
 * processes a time string by checking for an "inline" format (e.g., "6:00PM" or "1230 AM").
 * @param {string} time time input from user i.e. 12:00
 * @param {string} ampm AM/PM user input or AM/PM section (undefined for military time)
 * @returns 
 */
export function extractTimeParts(time, ampm) {
    // matches 1-4 digits (with or without a colon) immediately followed by AM or PM (case-insensitive)
    const inline = time.match(/^(\d{1,2}(?::\d{2})?|\d{3,4})(AM|PM)$/i);

    if (inline && ampm === undefined) {
        return {
            time: inline[1],
            ampm: inline[2].toUpperCase()
        };
    }

    return {
        time: time,
        ampm: ampm?.toUpperCase()
    };
}

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
 * checks to see if the time is valid and gets its corresponding hours and minutes if possible.
 * @param {string} time a string for the time section
 * @param {string} ampm a string for the ampm section
 * @returns {(Object | Boolean)} an Object literal if it is a valid set of strings (hours and minutes), and false if it is not
 */
export function getHoursAndMinutes(time, ampm) {
    // supports:
    // 8
    // 08
    // 800
    // 0800
    // 8:00
    // 08:00
    let hours = 0;
    let minutes = 0;

    if (time.includes(":")) { // for all colon'd time i.e. 12:00, 13:00
        if (!/^\d{1,2}:\d{2}$/.test(time)) return false;

        const parts = time.split(":");
        hours = parts[0];
        minutes = parts[1];
    } else {
        const strLen = time.length;

        if (strLen === 1 || strLen === 2) { // considers first 2 digits to always be hours, so HH format
            hours = time;
        } else if (strLen === 3) { // i.e. 145, 235 becomes H:MM
            hours = time.charAt(0);
            minutes = time.slice(1);
        } else if (strLen === 4) { // i.e. 1030, 1150 becomes HH:MM
            hours = time.slice(0, 2);
            minutes = time.slice(2);
        } else {
            return false;
        }
    }
    hours = Number(hours);
    minutes = Number(minutes);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) return false;
    if (minutes < 0 || minutes >= 60) return false;

    // validate FIRST based on the input mode
    if (ampm) {
        const upperAMPM = ampm.toUpperCase();

        if (hours < 1 || hours > 12) return false;

        // then convert to 24-hour time
        if (upperAMPM === "AM") {
            if (hours === 12) hours = 0;
        } else if(upperAMPM === "PM"){
            if (hours !== 12) hours += 12;
        }
    } else {
        if (hours < 0 || hours > 23) return false;
    }

    return { hours, minutes };
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

// arbitrary calculation for DST of a given date
/**
 * determines if daylight savings is currently active in North America given a date
 * @param {Date} date a date
 * @returns if the given date has daylight savings in North America
 */
function isNorthAmericaDST(date) {
    const year = date.getFullYear();

    // Second Sunday in March, 2:00 AM 
    const march1 = new Date(year, 2, 1);
    const firstSundayOffsetMarch = (7 - march1.getDay()) % 7;
    const secondSundayMarch = 1 + firstSundayOffsetMarch + 7;
    const dstStart = new Date(year, 2, secondSundayMarch, 2, 0, 0);

    // First Sunday in November, 2:00 AM
    const nov1 = new Date(year, 10, 1);
    const firstSundayOffsetNov = (7 - nov1.getDay()) % 7;
    const firstSundayNov = 1 + firstSundayOffsetNov;
    const dstEnd = new Date(year, 10, firstSundayNov, 2, 0, 0);

    return date >= dstStart && date < dstEnd;
}

/**
 * determines if daylight savings is currently active in Australia given a date
 * @param {Date} date a date
 * @returns if the given date has daylight savings in Australia
 */
function isAustraliaDST(date) {
    const year = date.getFullYear();

    // First Sunday in October, 2:00 AM
    const oct1 = new Date(year, 9, 1);
    const firstSundayOffsetOct = (7 - oct1.getDay()) % 7;
    const firstSundayOct = 1 + firstSundayOffsetOct;
    const dstStart = new Date(year, 9, firstSundayOct, 2, 0, 0);

    // First Sunday in April, 3:00 AM
    const apr1 = new Date(year, 3, 1);
    const firstSundayOffsetApr = (7 - apr1.getDay()) % 7;
    const firstSundayApr = 1 + firstSundayOffsetApr;
    const dstEnd = new Date(year, 3, firstSundayApr, 3, 0, 0);

    // Southern hemisphere DST spans across year end
    return date >= dstStart || date < dstEnd;
}

/**
 * checks to see if the given time zone has daylight savings
 * @param {string} tz a time zone abbreviation (e.g. PST, CEST, CET, etc.)
 * @returns {Boolean} if the time zome given has daylight savings
 */
function checkDaylightSavings(tz) {
    const zone = String(tz).toUpperCase().trim();
    const today = new Date();

    switch (zone) {
        // North America
        case "ET":
        case "CT":
        case "MT":
        case "PT":
            return isNorthAmericaDST(today);

        // Australia
        case "AET":
        case "ACT-AUSTRALIA":
            return isAustraliaDST(today);
        default:
            return false;
    }
}

/**
 * converts your detected local time zone to the inputted time zone abbreviation.
 * @param {Object} fromTime an Object mapping of the local time zone
 * @param {Object} toTime an Object mapping for {time, ampm, tz}
 * @returns {string} a text display of the converted time
 */
function convertToLocal(fromTime, toTime) {
    const toTimeZone = toTime.gmtOffset / 3600;
    const { hours, minutes } = getHoursAndMinutes(fromTime.time, fromTime.ampm);
    let fromTimeZone = timezoneOffsets[fromTime.tz];

    if (Array.isArray(fromTimeZone)) { // array == [no dst, with dst] in timzoneOffsets
        const idx = checkDaylightSavings(fromTime.tz) ? 1 : 0;
        fromTimeZone = fromTimeZone[idx];
    }

    const totalOffset = toTimeZone - fromTimeZone; // gmt offset in hours
    const hourDiff = Math.floor(totalOffset);
    const minuteDiff = Math.round((totalOffset - hourDiff) * 60);

    let actualMinutes = minutes + minuteDiff;
    let actualHours = hours + hourDiff;
    let dayOffset = 0;

    while (actualMinutes >= 60) {
        actualMinutes -= 60;
        actualHours += 1;
    }

    while (actualMinutes < 0) {
        actualMinutes += 60;
        actualHours -= 1;
    }

    while (actualHours >= 24) {
        actualHours -= 24;
        dayOffset += 1;
    }

    while (actualHours < 0) {
        actualHours += 24;
        dayOffset -= 1;
    }

    const displayAMPM = actualHours >= 12 ? "PM" : "AM";
    const displayHour = actualHours % 12 === 0 ? 12 : actualHours % 12;
    const displayMinute = String(actualMinutes).padStart(2, "0"); // pad with 00 if less than length 2 (e.g. 3 -> 03)

    let dayText = "";
    if (dayOffset === 1) dayText = " (next day)";
    else if (dayOffset === -1) dayText = " (previous day)";
    else if (dayOffset > 1) dayText = ` (${dayOffset} days later)`;
    else if (dayOffset < -1) dayText = ` (${Math.abs(dayOffset)} days earlier)`;

    return `${displayHour}:${displayMinute} ${displayAMPM}${dayText} in ${toTime.zoneName}`;
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
