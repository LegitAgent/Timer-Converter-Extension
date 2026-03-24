import { DOM } from "./dom.js";
import { storageLocal, storageSession } from "./storage.js";

/**
 * gets the current location of the user.
 * @returns latitude and longitude of user location
 */
export function getLocation() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            (err) => reject(err)
        );
    });
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
        chrome.runtime.sendMessage({ action: "getTimezone", latitude, longitude }, (response) => {

            if (chrome.runtime.lastError || !response?.success) {
                console.error("Fetch failed: ", chrome.runtime.lastError || response?.error);
                DOM.locationButton.textContent = "Error";
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
        chrome.runtime.sendMessage({ action: "getTimezoneList" }, (response) => {

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
