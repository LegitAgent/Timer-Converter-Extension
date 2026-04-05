import { DOM } from "./dom.js";
import { storageLocal, storageSession } from "./storage.js";

const GEOLOCATION_TIMEOUT_MS = 12000;
const GEOLOCATION_FALLBACK_MS = 5000;
const RUNTIME_MESSAGE_TIMEOUT_MS = 15000;

/**
 * gets the current location of the user.
 * @returns latitude and longitude of user location
 */
export function getLocation() {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeoutId = window.setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new Error("Location request timed out. Check browser and device location access, then try again."));
        }, GEOLOCATION_TIMEOUT_MS);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timeoutId);
                resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            },
            (err) => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timeoutId);
                reject(err);
            },
            {
                enableHighAccuracy: false,
                timeout: GEOLOCATION_TIMEOUT_MS,
                maximumAge: 300000
            }
        );
    });
}

/**
 * resolves once geolocation returns, or null if it does not complete quickly enough.
 * This keeps location-first behavior without leaving the popup blocked indefinitely.
 * @returns {Promise<{ latitude: number, longitude: number } | null>}
 */
export function getLocationWithFallback() {
    return Promise.race([
        getLocation(),
        new Promise((resolve) => {
            window.setTimeout(() => resolve(null), GEOLOCATION_FALLBACK_MS);
        })
    ]).catch(() => null);
}

/**
 * parses a timezone offset like GMT+8 or GMT-04:30 into seconds.
 * @param {string} value GMT offset string
 * @returns {number}
 */
function parseGMTOffsetToSeconds(value) {
    const normalized = String(value).replace("UTC", "GMT");
    const match = normalized.match(/GMT(?<sign>[+-])(?<hours>\d{1,2})(?::(?<minutes>\d{2}))?/i);

    if (!match?.groups) {
        return 0;
    }

    const sign = match.groups.sign === "-" ? -1 : 1;
    const hours = Number(match.groups.hours);
    const minutes = Number(match.groups.minutes || "0");

    return sign * ((hours * 3600) + (minutes * 60));
}

/**
 * computes the current offset in seconds for an IANA timezone.
 * @param {string} timeZone IANA timezone name
 * @returns {number}
 */
function getCurrentOffsetSeconds(timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        timeZoneName: "shortOffset"
    }).formatToParts(new Date());

    const offsetLabel = parts.find((part) => part.type === "timeZoneName")?.value || "GMT";
    return parseGMTOffsetToSeconds(offsetLabel);
}

/**
 * builds a local timezone object using the browser timezone when geolocation is unavailable.
 * Prefers the cached timezone list so the returned shape matches API results.
 * @returns {Promise<{ zoneName: string, gmtOffset: number, dst: number }>}
 */
export async function getIntlFallbackTimezone() {
    const zoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (!zoneName) {
        throw new Error("Browser timezone could not be determined.");
    }

    const { timezone_list } = await storageSession.get("timezone_list");
    const matchedZone = timezone_list?.zones?.find((zone) => zone.zoneName === zoneName);

    if (matchedZone) {
        return matchedZone;
    }

    return {
        zoneName,
        gmtOffset: getCurrentOffsetSeconds(zoneName),
        dst: 0
    };
}

// FETCHES

/**
 * gets the current time zone provided a latitude and longitude.
 * @param {Float} latitude latitude of location
 * @param {Float} longitude longitude of location
 * @returns location dictionary returned by the timezone API
 */
export function fetchTimezone(latitude, longitude) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeoutId = window.setTimeout(() => {
            if (settled) return;
            settled = true;
            DOM.locationButton.textContent = "Try Again";
            DOM.locationButton.classList.remove("loading");
            reject(new Error("Timezone lookup timed out. Please try again."));
        }, RUNTIME_MESSAGE_TIMEOUT_MS);

        chrome.runtime.sendMessage({ action: "getTimezone", latitude, longitude }, (response) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);

            if (chrome.runtime.lastError || !response?.success) {
                console.error("Fetch failed: ", chrome.runtime.lastError || response?.error);
                DOM.locationButton.textContent = "Try Again";
                DOM.locationButton.classList.remove("loading");
                reject(chrome.runtime.lastError || new Error(response?.error || "Unknown error"));
                return;
            }
            
            const data = response.data;
            storageLocal.set({ timezone_now: data, cached_lat: latitude, cached_lng: longitude });
            console.log("Fetched successfully");
            resolve(data);
        });
    });
}

/**
 * gets the list of time zones from the timezone API
 * @returns the list of available time zones from the timezone API
 */
export function fetchTimezoneList() {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeoutId = window.setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new Error("Timezone list request timed out."));
        }, RUNTIME_MESSAGE_TIMEOUT_MS);

        chrome.runtime.sendMessage({ action: "getTimezoneList" }, (response) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);

            if (chrome.runtime.lastError || !response?.success) {
                console.error("Fetch failed: ", chrome.runtime.lastError || response?.error);
                reject(chrome.runtime.lastError || new Error(response?.error || "Unknown error"));
                return;
            }

            const data = response.data;
            storageSession.set({ timezone_list: data });
            console.log("Fetched time zone list successfully");
            resolve(data);
        });
    });
}
