document.getElementById("getLocation").addEventListener("click", async () => {
    try {
        const{latitude, longitude} = await getLocation();
        const lat_long_element = document.getElementById('output');
        lat_long_element.textContent = `Latitude: ${latitude} Longitude: ${longitude}`;

        chrome.runtime.sendMessage(
            {action: "getTimezone", latitude, longitude},
            (response) => {
                if (response.success) {
                    console.log("Timezone data:", response.data);
                    document.getElementById('timezone').textContent =
                        `Timezone: ${response.data.zoneName} (${response.data.abbreviation})`;
                } else {
                    console.error("Error fetching timezone:", response.error);
                }
            }
        );
    } catch (error) {
        console.error(error)
    }
});

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
