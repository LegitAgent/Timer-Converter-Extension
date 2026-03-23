import { storageLocal } from "./storage.js";
import { timezoneOffsets } from "./timezoneOffsets.js";
import { convertToLocal } from "./timeConversion.js";
// maintaining toggle code here...
/**
 * filters through links that are banned for injecting scripts into
 * @param {string} url a url string input
 * @returns 
 */
function canInjectIntoUrl(url) {
    return Boolean(
        url &&
        !url.startsWith("chrome://") &&
        !url.startsWith("edge://") &&
        !url.startsWith("about:") &&
        !url.startsWith("chrome-extension://")
    );
}

/**
 * inject timezoneDetectScript.js into a tab if it is a normal web page
 * @param {number} tabId
 */
async function injectScript(tabId) {
    const tab = await chrome.tabs.get(tabId);

    if (!canInjectIntoUrl(tab?.url)) {
        console.log("Blocked URL, not injecting.");
        return false;
    }

    // inject script into tab id
    await chrome.scripting.executeScript({
        target: { tabId },
        files: ["scripts/timezoneDetectScript.js"]
    });
    return true;
}

/**
 * send current extension state to a tab
 * @param {number} tabId
 */
async function syncTabState(tabId) {
    const { popupState } = await storageLocal.get("popupState");
    const enabled = Boolean(popupState?.extensionEnabled);

    const success = await injectScript(tabId);
    if (!success) return;

    await chrome.tabs.sendMessage(tabId, {
        type: "TIME_EXTENSION_SET_OFFSETS",
        offsets: timezoneOffsets
    });

    await chrome.tabs.sendMessage(tabId, {
        type: "TIME_EXTENSION_TOGGLE",
        enabled
    });
}

/**
 * send current extension state to every normal web tab.
 */
async function syncAllTabsState() {
    const tabs = await chrome.tabs.query({});

    // syncs all tabs to the current active tab state (i.e., toggle for injection)
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
 * listener for chrome.sendMessage. Triggers when sending messages via chrome.runtime.sendmessage. Gets API requests from api.js
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
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

                        const clean = converted.replace(/\s+in\s+.+$/, ""); // clean format
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

    fetch(url)
        .then(res => {
            if (!res.ok) throw new Error(`Server Error: ${res.status}`);
            return res.json();
        })
        .then(data => sendResponse({ success: true, data }))
        .catch(err => {
            console.error("Fetch failed: ", err);
            sendResponse({ success: false, error: err.message });
        });

    return true;
});

/**
 * listener for chrome.tabs. Triggers when switching tabs
 * updates to the current toggle state
 */
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    try {
        // inject script and send ON/OFF state
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
 * Triggers when there are changes with the toggle button, which is stored in storage.local
 */
chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName !== "local" || !changes.popupState) return;

    const previousEnabled = changes.popupState.oldValue?.extensionEnabled;
    const currentEnabled = changes.popupState.newValue?.extensionEnabled;

    if (previousEnabled === currentEnabled) return;

    try {
        await syncAllTabsState();
    } catch (error) {
        console.error("Failed to sync all tabs after toggle change:", error);
    }
});
