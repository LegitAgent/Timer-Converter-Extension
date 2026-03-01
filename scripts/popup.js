const button = document.getElementById("getLocation");
const timezoneDiv = document.getElementById("timezone");

button.addEventListener("click", async () => {
    button.classList.add("loading");
    button.textContent = "Detecting...";
    try {
        const {latitude, longitude} = await getLocation();
        const {timezone_now, cached_lat, cached_lng} = await chrome.storage.sync.get(["timezone_now", "cached_lat", "cached_lng"]);
        
        const isSameLocation = cached_lat !== undefined && cached_lng !== undefined && Math.abs(latitude - cached_lat) < 0.0001 && Math.abs(longitude - cached_lng) < 0.0001;

        // if it is in storage and the same spot, then don't fetch
        if(timezone_now && isSameLocation) {
            timeZoneFetchSuccessDesign(button, timezoneDiv, timezone_now);
            console.log("Loaded timezone from storage");
        } else {
            // fetch otherwise
            console.log("Fetching data from server...");

            chrome.runtime.sendMessage(
            {action: "getTimezone", latitude, longitude},
                async (response) => {
                    if (response.success) {
                        const data = response.data;
                        // store it to storage
                        await chrome.storage.sync.set({ timezone_now: data, cached_lat: latitude, cached_lng: longitude})
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

// success on timezone fetch
function timeZoneFetchSuccessDesign(button, text, timezone) {
    text.textContent = `Your Timezone: ${timezone.zoneName}`;
    text.classList.add("success");

    button.classList.remove("loading");
    button.textContent = "Location Retrieved";
}
