// get state
chrome.storage.local.get("popupState", (data) => {
    if(!data.popupState) return;
    // for text area
    const textAreas = data.popupState.textAreas || {};
    Object.keys(textAreas).forEach((id) => {  
        const el = document.getElementById(id);
        if (el) el.value = textAreas[id];
    });
    // for timezone output in getlocation
    const timezoneOut = data.popupState.timezoneOut;
    if(timezoneOut) {
        const timezoneOutEl = document.querySelector("#timezone");
        timezoneOutEl.textContent = timezoneOut;
    }
    // for nav bar
    const savedTab = data.popupState.tab;
    if (savedTab) {
        const btn = document.querySelector(`.unselectable.navBtn[data-tab="${savedTab}"]`);
        if (btn) btn.click();
    }
});

const button = document.getElementById("getLocation");
const timezoneDiv = document.getElementById("timezone");

button.addEventListener("click", async () => {
    button.classList.add("loading");
    button.textContent = "Detecting...";
    try {
        const {latitude, longitude} = await getLocation();
        const {timezone_now, cached_lat, cached_lng} = await chrome.storage.local.get(["timezone_now", "cached_lat", "cached_lng"]);
        
        const isSameLocation = cached_lat !== undefined && cached_lng !== undefined && Math.abs(latitude - cached_lat) < 0.001 && Math.abs(longitude - cached_lng) < 0.001;

        // if it is in storage and the same spot, then don't fetch
        if(timezone_now && isSameLocation) {
            timeZoneFetchSuccessDesign(button, timezoneDiv, timezone_now);
            console.log("Loaded timezone from storage");
        } else {
            // fetch otherwise
            console.log("Fetching data from server...");

            chrome.runtime.sendMessage(
            {action: "getTimezone", latitude, longitude},
                (response) => {
                    if (chrome.runtime.lastError) {
                            console.error("Message failed:", chrome.runtime.lastError);
                            button.textContent = "Error";
                            button.classList.remove("loading");
                            return;
                    }
                    if (response && response.success) {
                        const data = response.data;
                        // store it to storage
                        chrome.storage.local.set({ timezone_now: data, cached_lat: latitude, cached_lng: longitude});
                        timeZoneFetchSuccessDesign(button, timezoneDiv, data);
                        console.log("Success");
                    } else {
                        console.error("Error fetching timezone:", response.error);
                    }
                }
            );
        }
    } catch (error) {
        button.classList.remove("loading");
        button.textContent = "Permission Denied";
        console.error(error)
    }
});

// get geolocation of position
function getLocation() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
            },
            (error) => {
                reject(error);
            }
        );
    });
}

// storing states
const textAreas = document.querySelectorAll("textarea");
textAreas.forEach((textArea) => {
    textArea.addEventListener('input', savePopupState);
});

function savePopupState() {
    const tabState = document.querySelector(".unselectable.navBtn.active").dataset.tab;
    const textAreaData = {};
    const timezoneOut = document.querySelector("#timezone").textContent;

    textAreas.forEach((textarea) => {
        textAreaData[textarea.id] = textarea.value;
    });

    chrome.storage.local.set({popupState: {
        tab: tabState,
        textAreas: textAreaData,
        timezoneOut: timezoneOut
    }});
}

// DESIGN EDITING

// success on timezone fetch
function timeZoneFetchSuccessDesign(button, text, timezone) {
    text.textContent = `${timezone.zoneName}`;
    text.classList.add("success");

    button.classList.remove("loading");
    button.textContent = "Location Retrieved";

    savePopupState();
}

// animations
const tabs = document.querySelectorAll(".navBtn");
const slider = document.querySelector(".navSlider");
const track = document.querySelector(".tabsTrack");

tabs.forEach((btn, index) => {
    btn.addEventListener("click", () => {
        tabs.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        // animation
        slider.style.transform = `translateX(${index * 100}%)`; // slide for nav bar
        
        track.style.transform = `translateX(-${index * 50}%)`; // slide for tab content
        savePopupState();
    })
})
