import { storageLocal } from "./storage.js";
import { timezoneOffsets } from "./timezoneOffsets.js";
import { convertToLocal } from "./timeConversion.js";

const FETCH_TIMEOUT_MS = 15000;
/**
 * filters out URLs where the extension should not sync page state
 * @param {string} url a URL string input
 * @returns {boolean}
 */
function canInjectIntoUrl(url) {
    return Boolean(
        url &&
        !url.startsWith("chrome://") &&
        !url.startsWith("edge://") &&
        !url.startsWith("about:") &&
        !url.startsWith("chrome-extension://") &&
        !url.startsWith("https://chromewebstore.google.com/") &&
        !url.startsWith("https://chrome.google.com/webstore/")
    );
}

/**
 * send a message to a tab if the manifest content script is present.
 * Tabs that were already open before the extension reloaded will not have
 * the receiver until they navigate or refresh.
 * @param {Number} tabId
 * @param {Object} message
 * @returns {Promise<boolean>}
 */
async function sendTabMessageIfReady(tabId, message) {
    try {
        await chrome.tabs.sendMessage(tabId, message);
        return true;
    } catch (error) {
        if (error?.message?.includes("Receiving end does not exist")) {
            return false;
        }

        throw error;
    }
}

/**
 * send current extension state to a tab
 * @param {Number} tabId
 */
async function syncTabState(tabId) {
    const tab = await chrome.tabs.get(tabId);

    if (!canInjectIntoUrl(tab?.url)) {
        console.log("Blocked URL, not syncing.");
        return;
    }

    const { popupState } = await storageLocal.get("popupState");
    const enabled = Boolean(popupState?.extensionEnabled);

    const offsetsSent = await sendTabMessageIfReady(tabId, {
        type: "TIME_EXTENSION_SET_OFFSETS",
        offsets: timezoneOffsets
    });

    if (!offsetsSent) {
        return;
    }

    await sendTabMessageIfReady(tabId, {
        type: "TIME_EXTENSION_TOGGLE",
        enabled
    });
}

/**
 * send current extension state to every normal web tab.
 */
async function syncAllTabsState() {
    const tabs = await chrome.tabs.query({});

    // sync all eligible tabs to the current toggle/timezone state
    await Promise.all(
        tabs
            .filter((tab) => tab.id && canInjectIntoUrl(tab.url))
            .map((tab) =>
                syncTabState(tab.id).catch((error) => {
                    console.error(`Failed to sync tab ${tab.id}:`, error);
                })
            )
    );
}

/**
 * listens for messages from popup/content scripts and handles conversion/API requests
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    
    // content script conversion
    if (msg.action === "convertDetectedTimes") {
        storageLocal.get("timezone_now")
            .then(({ timezone_now }) => {
                const localTimezone = timezone_now;

                // check if have pressed get location
                if (!localTimezone) {
                    sendResponse({
                        success: false,
                        error: "Get your time zone first from the Paste & Convert tab!"
                    });
                    return;
                }

                const items = Array.isArray(msg.items) ? msg.items : [];

                const results = items.map((item) => {
                    try {
                        const converted = convertToLocal({
                            time: item.time,
                            ampm: item.ampm,
                            tz: item.timezone
                        }, localTimezone);

                        const clean = converted.replace(/\s+in\s+.+$/, ""); // clean format (eliminate "in ${toTime.zoneName}") 
                        return {
                            key: item.key,
                            convertedTime: `${clean} ${localTimezone.zoneName}`
                        };
                    } catch (error) {
                        return {
                            key: item.key,
                            convertedTime: null
                        };
                    }
                });

                sendResponse({ success: true, results, localTimezone });
            })
            .catch((error) => {
                console.error("Failed to convert detected times:", error);
                sendResponse({ success: false, error: error.message });
            });

        return true;
    }

    // API sending and receiving

    let url = '';
    if (msg.action === "getTimezone") {
        const { latitude, longitude } = msg;
        url = `https://timezone-proxy.albamartindarius.workers.dev/timezone?latitude=${latitude}&longitude=${longitude}`;
    } else if (msg.action === "getTimezoneList") {
        url = `https://timezone-proxy.albamartindarius.workers.dev/listtimezones`;
    } else {
        sendResponse({ success: false, error: "Unknown action" });
        return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    fetch(url, { signal: controller.signal })
        .then(res => {
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error(`Server Error: ${res.status}`);
            return res.json();
        })
        .then(data => sendResponse({ success: true, data }))
        .catch(err => {
            clearTimeout(timeoutId);
            console.error("Fetch failed: ", err);
            sendResponse({
                success: false,
                error: err.name === "AbortError"
                    ? "Request timed out before the timezone service responded."
                    : err.message
            });
        });

    return true;
});

/**
 * listener for chrome.tabs. Triggers when switching tabs
 * updates to the current toggle state
 */
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    try {
        await syncTabState(tabId);
    } catch (error) {
        console.error("Failed to sync activated tab:", error);
    }
});

/**
 * listener for chrome.tabs. Triggers when loading or reloading a tab
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete") return; // if page is NOT fully loaded

    try {
        await syncTabState(tabId);
    } catch (error) {
        console.error("Failed to sync updated tab:", error);
    }
});

/**
 * sync open tabs when the toggle state or detected local timezone changes
 */
chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName !== "local") return;

    const popupStateChanged = Boolean(changes.popupState);
    const timezoneChanged = Boolean(changes.timezone_now);

    if (!popupStateChanged && !timezoneChanged) return;

    if (popupStateChanged) {
        const previousEnabled = changes.popupState.oldValue?.extensionEnabled;
        const currentEnabled = changes.popupState.newValue?.extensionEnabled;

        if (previousEnabled === currentEnabled && !timezoneChanged) {
            return;
        }
    }

    try {
        await syncAllTabsState();
    } catch (error) {
        console.error("Failed to sync all tabs after toggle change:", error);
    }
});
