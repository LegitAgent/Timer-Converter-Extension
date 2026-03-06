chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "getTimezone") {
        const { latitude, longitude } = msg;

        const URL = `https://timezone-server.onrender.com/timezone?latitude=${latitude}&longitude=${longitude}`;

        fetch(URL) // GET
            .then(res => {
                if(!res.ok) throw new Error(`Server Error: ${res.status}`);
                return res.json();
            }) // returns a response object, contains headers and status codes, jsonify, so JS can read it
            .then(data => sendResponse({ success: true, data })) // sets success to true, and returns data
            .catch(err => { 
                console.error("Fetch failed: ", err);
                sendResponse({ success: false, error: err.message })
            });

        return true;
    }
});
