chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "getTimezone") {
        const { latitude, longitude } = msg;
        const URL = `https://api.timezonedb.com/v2.1/get-time-zone?key=${API_KEY}&format=json&by=position&lat=${latitude}&lng=${longitude}`;

        fetch(URL)
        .then(res => res.json())
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));

        return true; // keep the message channel open
    }
});