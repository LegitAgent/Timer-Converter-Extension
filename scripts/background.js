chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "getTimezone") {
        const { latitude, longitude } = msg;

        const URL = `http://timezone-server.onrender.com/timezone?latitude=${latitude}&longitude=${longitude}`;

        fetch(URL)
            .then(res => res.json())
            .then(data => sendResponse({ success: true, data }))
            .catch(err => sendResponse({ success: false, error: err.message }));

        return true;
    }
});
