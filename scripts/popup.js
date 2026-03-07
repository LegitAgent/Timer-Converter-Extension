const DOM = {
    locationButton: document.getElementById("getLocation"),
    timezoneDiv: document.getElementById("timezone"),
    textAreas: document.querySelectorAll("textarea"),
    tabs: document.querySelectorAll(".navBtn"),
    slider: document.querySelector(".navSlider"),
    track: document.querySelector(".tabsTrack")
};

/**
 * STORAGE HELPERS
 * Promisifying chrome.storage makes async/await logic much cleaner.
 */
const storage = {
    get: (keys) => new Promise((response) => chrome.storage.local.get(keys, response)),
    set: (data) => new Promise((response) => chrome.storage.local.set(data, response))
};

/**
 * STATE MANAGEMENT
 */
async function savePopupState() {
    const activeTab = document.querySelector(".navBtn.active")?.dataset.tab;
    const textAreaData = {};
    
    DOM.textAreas.forEach(el => textAreaData[el.id] = el.value);

    await storage.set({
        popupState: {
            tab: activeTab,
            textAreas: textAreaData,
            timezoneOut: DOM.timezoneDiv.textContent
        }
    });
}

async function restoreState() {
    const { popupState } = await storage.get("popupState");
    if (!popupState) return;

    // restore text Areas
    if (popupState.textAreas) {
        Object.entries(popupState.textAreas).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        });
    }

    // testore timezone Text
    if (popupState.timezoneOut) {
        DOM.timezoneDiv.textContent = popupState.timezoneOut;
    }

    // restore active tab
    if (popupState.tab) {
        const savedTabBtn = document.querySelector(`.navBtn[data-tab="${popupState.tab}"]`);
        savedTabBtn?.click(); // ? = does it exist (is it null)
    }
}

/**
 * GEOLOCATION & API LOGIC
 */
function getLocation() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            (err) => reject(err)
        );
    });
}

async function handleLocationRequest() {
    DOM.locationButton.classList.add("loading");
    DOM.locationButton.textContent = "Detecting...";

    try {
        const { latitude, longitude } = await getLocation();
        const { timezone_now, cached_lat, cached_lng } = await storage.get(["timezone_now", "cached_lat", "cached_lng"]);

        // check if user is in the same spot (approx 100m)
        const isSameLocation = cached_lat !== undefined && 
                               cached_lng !== undefined &&
                               Math.abs(latitude - cached_lat) < 0.001 && 
                               Math.abs(longitude - cached_lng) < 0.001;

        if (timezone_now && isSameLocation) {
            applyTimezoneUI(timezone_now);
            console.log("Loaded from cache");
        } else {
            console.log("Fetching from server...");
            fetchTimezone(latitude, longitude);
            console.log("Fetched successfully");
        }
    } catch (error) {
        DOM.locationButton.classList.remove("loading");
        DOM.locationButton.textContent = "Permission Denied";
        console.error(error);
    }
}

function fetchTimezone(latitude, longitude) {
    chrome.runtime.sendMessage({ action: "getTimezone", latitude, longitude }, (response) => {
        if (chrome.runtime.lastError || !response?.success) { // null or err
            console.error("Fetch failed:", chrome.runtime.lastError || response?.error);
            DOM.locationButton.textContent = "Error";
            DOM.locationButton.classList.remove("loading");
            return;
        }

        const data = response.data;
        storage.set({ timezone_now: data, cached_lat: latitude, cached_lng: longitude });
        applyTimezoneUI(data);
    });
}

/**
 * UI UPDATES & ANIMATIONS
 */
function applyTimezoneUI(timezone) {
    DOM.timezoneDiv.textContent = timezone.zoneName;
    DOM.timezoneDiv.classList.add("success");
    DOM.locationButton.classList.remove("loading");
    DOM.locationButton.textContent = "Location Retrieved";
    savePopupState();
}

function init() {
    // tab switching logic
    DOM.tabs.forEach((btn, index) => {
        btn.addEventListener("click", () => {
            DOM.tabs.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            DOM.slider.style.transform = `translateX(${index * 100}%)`; // navbar switch
            DOM.track.style.transform = `translateX(-${index * 50}%)`; // tab content switch
            
            savePopupState();
        });
    });

    DOM.textAreas.forEach(el => el.addEventListener("input", savePopupState));
    DOM.locationButton.addEventListener("click", handleLocationRequest);

    restoreState();
}

document.addEventListener("DOMContentLoaded", init);
