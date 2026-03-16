import { DOM } from "./dom.js";
import { savePopupState } from "./manageState.js";
import { storageLocal } from "./storage.js";
import { timezoneOffsets } from "./timezoneOffsets.js";

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

function extractTimeParts(time, ampm) {
    const inline = time.match(/^(\d{1,2}(?::\d{2})?|\d{3,4})(AM|PM)$/i);

    if (inline) {
        return {
            time: inline[1],
            ampm: inline[2].toUpperCase()
        };
    }

    return {
        time,
        ampm: ampm?.toUpperCase()
    };
}

// STANDARD FORMAT: TIME [AM/PM] TIMEZONE
function checkStandardFormat(str) {
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
function checkReverseFormat(str) {
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

function isValidTimezone(tz) {
    return Object.hasOwn(timezoneOffsets, tz);
}

function isValidAMPM(ampm) {
    if (ampm === undefined) return true;
    return ampm === "AM" || ampm === "PM";
}

function getHoursAndMinutes(time, ampm) {
    // supports:
    // 8
    // 08
    // 800
    // 0800
    // 8:00
    // 08:00
    let hours;
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

        if (upperAMPM !== "AM" && upperAMPM !== "PM") return false;
        if (hours < 1 || hours > 12) return false;

        // then convert to 24-hour time
        if (upperAMPM === "AM") {
            if (hours === 12) hours = 0;
        } else {
            if (hours !== 12) hours += 12;
        }
    } else {
        if (hours < 0 || hours > 23) return false;
    }

    return { hours, minutes };
}

function isValidTime(time, ampm) {
    return !!getHoursAndMinutes(time, ampm);
}

function checkDaylightSavings(tz) {

    // arbitrary
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

    // arbitrary
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

        // should never happen
        default:
            return false;
    }
}

function convertToLocal(fromTime, toTime) {
    const toTimeZone = toTime.gmtOffset / 3600;
    const { hours, minutes } = getHoursAndMinutes(fromTime.time, fromTime.ampm);
    let fromTimeZone = timezoneOffsets[fromTime.tz];

    if (Array.isArray(fromTimeZone)) {
        const idx = checkDaylightSavings(fromTime.tz) ? 1 : 0;
        fromTimeZone = fromTimeZone[idx];
    }

    const totalOffset = toTimeZone - fromTimeZone;
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
    const displayMinute = String(actualMinutes).padStart(2, "0");

    let dayText = "";
    if (dayOffset === 1) dayText = " (next day)";
    else if (dayOffset === -1) dayText = " (previous day)";
    else if (dayOffset > 1) dayText = ` (${dayOffset} days later)`;
    else if (dayOffset < -1) dayText = ` (${Math.abs(dayOffset)} days earlier)`;

    return `${displayHour}:${displayMinute} ${displayAMPM}${dayText} in ${toTime.zoneName}`;
}

export async function convertPastedTime() {
    const { timezone_now } = await storageLocal.get("timezone_now");
    if (!timezone_now) {
        DOM.copyPasteOutput.textContent = "Get your time zone first!";
        return;
    }
    
    try {
        const sanitizedText = sanitizeTimeInput(DOM.copyPasteInput.value);
        const valid = checkStandardFormat(sanitizedText) || checkReverseFormat(sanitizedText);
        if (!valid) {
            DOM.copyPasteOutput.innerHTML = "Invalid format, use format:<br> <b>(00:00) (AM/PM optional) (time zone)</b> <br> or <br> <b>(time zone) (00:00) (AM/PM optional)</b>";
            savePopupState();
            return;
        }
        
        const validTimezone = isValidTimezone(valid.tz);
        if (!validTimezone) {
            DOM.copyPasteOutput.innerHTML = "<b>Invalid time zone.</b>";
            savePopupState();
            return;
        }

        const validAMPM = isValidAMPM(valid.ampm);
        if (!validAMPM) {
            DOM.copyPasteOutput.innerHTML = "<b>Invalid AM/PM format.</b>";
            savePopupState();
            return;
        }

        const validTime = isValidTime(valid.time, valid.ampm);
        if (!validTime) {
            DOM.copyPasteOutput.innerHTML = "<b>Invalid time or invalid time format.</b>";
            savePopupState();
            return;
        }

        const convertedTime = convertToLocal(valid, timezone_now);
        DOM.copyPasteOutput.innerHTML = `${convertedTime}`;
        savePopupState();
    } catch (error) {
        console.error(error);
    }
}
