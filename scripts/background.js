import { storageLocal } from "./storage.js";

/**
 * inject test.js into a tab if it is a normal web page
 * @param {number} tabId
 */
async function injectScript(tabId) {
    const tab = await chrome.tabs.get(tabId);
    console.log("Trying to inject into:", tabId, tab?.url);

    if (
        !tab.url ||
        tab.url.startsWith("chrome://") ||
        tab.url.startsWith("edge://") ||
        tab.url.startsWith("about:") ||
        tab.url.startsWith("chrome-extension://")
    ) {
        console.log("Blocked URL, not injecting.");
        return false;
    }

    await chrome.scripting.executeScript({
        target: { tabId },
        files: ["scripts/test.js"]
    });

    console.log("Injected successfully into tab:", tabId);
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

    await chrome.scripting.executeScript({
        target: { tabId },
        func: (enabledNow) => {
            window.postMessage({
                type: "TIME_EXTENSION_TOGGLE",
                enabled: enabledNow
            }, "*");
        },
        args: [enabled]
    });
}

/**
 * listener for chrome.sendMessage. Triggers when sending messages via chrome.runtime.sendmessage. Gets API requests from api.js
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
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
