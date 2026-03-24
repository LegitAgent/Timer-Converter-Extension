import { timezoneOffsets } from "./timezoneOffsets.js";

/**
 * normalizes supported AM/PM inputs such as AM, PM, a.m., and p.m.
 * @param {string | undefined} ampm
 * @returns {string | undefined}
 */
export function normalizeAMPM(ampm) {
    if (typeof ampm !== "string") return undefined;

    const normalized = ampm.trim().replace(/\./g, "").toUpperCase();
    if (normalized === "AM" || normalized === "PM") {
        return normalized;
    }

    return ampm?.toUpperCase();
}

/**
 * processes a time string by checking for an "inline" format (e.g., "6:00PM" or "1230 AM").
 * @param {string} time time input
 * @param {string} ampm AM/PM user input or AM/PM section (undefined for military time)
 * @returns {{time: string, ampm: (string|undefined)}}
 */
export function extractTimeParts(time, ampm) {
    const inline = time.match(/^(\d{1,2}(?::\d{2})?|\d{3,4})(A\.?M\.?|P\.?M\.?)$/i);

    if (inline && ampm === undefined) {
        return {
            time: inline[1],
            ampm: normalizeAMPM(inline[2])
        };
    }

    return {
        time,
        ampm: normalizeAMPM(ampm)
    };
}

/**
 * checks to see if the time is valid and gets its corresponding hours and minutes if possible.
 * @param {string} time a string for the time section
 * @param {string} ampm a string for the ampm section
 * @returns {(Object | Boolean)} an Object literal if valid, otherwise false
 */
export function getHoursAndMinutes(time, ampm) {
    let hours = 0;
    let minutes = 0;

    if (time.includes(":")) {
        if (!/^\d{1,2}:\d{2}$/.test(time)) return false;

        const parts = time.split(":");
        hours = parts[0];
        minutes = parts[1];
    } else {
        const strLen = time.length;

        if (strLen === 1 || strLen === 2) {
            hours = time;
        } else if (strLen === 3) {
            hours = time.charAt(0);
            minutes = time.slice(1);
        } else if (strLen === 4) {
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

    if (ampm) {
        const upperAMPM = normalizeAMPM(ampm);

        if (hours < 1 || hours > 12) return false;

        if (upperAMPM === "AM") {
            if (hours === 12) hours = 0;
        } else if (upperAMPM === "PM") {
            if (hours !== 12) hours += 12;
        } else {
            return false;
        }
    } else {
        if (hours < 0 || hours > 23) return false;
    }

    return { hours, minutes };
}

/**
 * determines if daylight savings is currently active in North America given a date
 * @param {Date} date a date
 * @returns {Boolean} if the given date has daylight savings in North America
 */
function isNorthAmericaDST(date) {
    const year = date.getFullYear();

    const march1 = new Date(year, 2, 1);
    const firstSundayOffsetMarch = (7 - march1.getDay()) % 7;
    const secondSundayMarch = 1 + firstSundayOffsetMarch + 7;
    const dstStart = new Date(year, 2, secondSundayMarch, 2, 0, 0);

    const nov1 = new Date(year, 10, 1);
    const firstSundayOffsetNov = (7 - nov1.getDay()) % 7;
    const firstSundayNov = 1 + firstSundayOffsetNov;
    const dstEnd = new Date(year, 10, firstSundayNov, 2, 0, 0);

    return date >= dstStart && date < dstEnd;
}

/**
 * determines if daylight savings is currently active in Australia given a date
 * @param {Date} date a date
 * @returns {Boolean} if the given date has daylight savings in Australia
 */
function isAustraliaDST(date) {
    const year = date.getFullYear();

    const oct1 = new Date(year, 9, 1);
    const firstSundayOffsetOct = (7 - oct1.getDay()) % 7;
    const firstSundayOct = 1 + firstSundayOffsetOct;
    const dstStart = new Date(year, 9, firstSundayOct, 2, 0, 0);

    const apr1 = new Date(year, 3, 1);
    const firstSundayOffsetApr = (7 - apr1.getDay()) % 7;
    const firstSundayApr = 1 + firstSundayOffsetApr;
    const dstEnd = new Date(year, 3, firstSundayApr, 3, 0, 0);

    return date >= dstStart || date < dstEnd;
}

/**
 * checks to see if the given time zone has daylight savings
 * @param {string} tz a time zone abbreviation (e.g. PST, CEST, CET, etc.)
 * @returns {Boolean} if the time zone given has daylight savings
 */
function checkDaylightSavings(tz) {
    const zone = String(tz).toUpperCase().trim();
    const today = new Date();

    switch (zone) {
        case "ET":
        case "CT":
        case "MT":
        case "PT":
            return isNorthAmericaDST(today);
        case "AET":
        case "ACT-AUSTRALIA":
            return isAustraliaDST(today);
        default:
            return false;
    }
}

/**
 * converts a given time object to the user's local timezone.
 * @param {{time: string, ampm?: string, tz: string}} fromTime source time object
 * @param {{gmtOffset: number, zoneName: string}} toTime target timezone object
 * @returns {string} formatted local time
 */
export function convertToLocal(fromTime, toTime) {
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
