import { storageLocal } from "./storage.js";

/**
 * listener for chrome.sendMessage. Gets API requests from api.js
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    let url = '';
    if (msg.action === "getTimezone") {
        const {latitude, longitude} = msg;
        url = `https://timezone-proxy.albamartindarius.workers.dev/timezone?latitude=${latitude}&longitude=${longitude}`;
    } else if (msg.action === "getTimezoneList") {
        url = `https://timezone-proxy.albamartindarius.workers.dev/listtimezones`
    } else {
        sendResponse({ success: false, error: "Unknown action" });
        return;
    }
    fetch(url) // GET
        .then(res => {
            if(!res.ok) throw new Error(`Server Error: ${res.status}`);
            return res.json(); // parse to bytes to json object if no errors
        }) // returns a response object, contains headers and status codes, jsonify, so JS can read it
        .then(data => sendResponse({ success: true, data })) // sets success to true, and returns data
        .catch(err => { 
            console.error("Fetch failed: ", err);
            sendResponse({ success: false, error: err.message })
        });

    return true; // remain open
});

/**
 * run script when switching to an active tab, but only if toggle is ON
 */
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    const { popupState } = await storageLocal.get("popupState");
    if (!popupState?.extensionEnabled) return;

    const tab = await chrome.tabs.get(tabId);

    if (
        !tab.url ||
        tab.url.startsWith("chrome://") ||
        tab.url.startsWith("edge://") ||
        tab.url.startsWith("about:") ||
        tab.url.startsWith("chrome-extension://")
    ) {
        return;
    }

    await chrome.scripting.executeScript({
        target: { tabId },
        files: ["scripts/test.js"]
    });
});

/**
 * also run when the page finishes loading, but only if toggle is ON
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete") return;

    const { popupState } = await storageLocal.get("popupState");
    if (!popupState?.extensionEnabled) return;

    if (
        !tab.url ||
        tab.url.startsWith("chrome://") ||
        tab.url.startsWith("edge://") ||
        tab.url.startsWith("about:") ||
        tab.url.startsWith("chrome-extension://")
    ) {
        return;
    }

    await chrome.scripting.executeScript({
        target: { tabId },
        files: ["scripts/test.js"]
    });
});