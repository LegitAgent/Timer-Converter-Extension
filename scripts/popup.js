// notes: UPDATE ID FOR CORS POLICY PROTECTION
const DOM = {
    locationButton: document.getElementById("getLocation"),
    timezoneDiv: document.getElementById("timezone"),
    textAreas: document.querySelectorAll("textarea"),
    tabs: document.querySelectorAll(".navBtn"),
    slider: document.querySelector(".navSlider"),
    track: document.querySelector(".tabsTrack"),

    sourceZoneInput: document.getElementById("sourceZoneSearch"),
    sourceZoneValue: document.getElementById("sourceZone"),
    sourceZoneList: document.getElementById("sourceZoneList"),

    targetZoneInput: document.getElementById("targetZoneSearch"),
    targetZoneValue: document.getElementById("targetZone"),
    targetZoneList: document.getElementById("targetZoneList"),
    
    hourPicker: document.getElementById("hourSelector"),
    minutePicker: document.getElementById("minuteSelector"),
    ampmPicker: document.getElementById("ampmSelector"),

    convertButton: document.getElementById("convertBtn"),
    convertOutput: document.getElementById("convertOutput")
};

/**
 * STORAGE HELPERS
 * Promisifying chrome.storage makes async/await logic much cleaner.
 */
const storageLocal = {
    get: (keys) => new Promise((response) => chrome.storage.local.get(keys, response)),
    set: (data) => new Promise((response) => chrome.storage.local.set(data, response))
};

const storageSession = {
    get: (keys) => new Promise((response) => chrome.storage.session.get(keys, response)),
    set: (data) => new Promise((response) => chrome.storage.session.set(data, response))
};

/******************
 * STATE MANAGEMENT
 ******************/

async function savePopupState() {
    try {
        const activeTab = document.querySelector(".navBtn.active")?.dataset.tab;
        const textAreaData = {};
        DOM.textAreas.forEach(el => textAreaData[el.id] = el.value);
        
        await storageLocal.set({
            popupState: {
                tab: activeTab,
                textAreas: textAreaData,
                timezoneOut: DOM.timezoneDiv.textContent,
                cachedSourceZoneInput: DOM.sourceZoneInput.value,
                cachedSourceZoneValue: DOM.sourceZoneValue.value,
                cachedTargetZoneInput: DOM.targetZoneInput.value,
                cachedTargetZoneValue: DOM.targetZoneValue.value,
                cachedHour: DOM.hourPicker.value,
                cachedMinute: DOM.minutePicker.value,
                cachedAMPM: DOM.ampmPicker.value
            }
        });
    } catch(error) {
        console.error("Failed to save popup state:", error);
    }
}

async function restoreState() {
    try {
        const { popupState } = await storageLocal.get("popupState");
        if (!popupState) return;

        if (popupState.textAreas) {
            Object.entries(popupState.textAreas).forEach(([id, value]) => {
                const el = document.getElementById(id);
                if (el) el.value = value;
            });
        }

        if(popupState.cachedSourceZoneInput && popupState.cachedSourceZoneValue) {
            DOM.sourceZoneInput.value = popupState.cachedSourceZoneInput;
            DOM.sourceZoneValue.value = popupState.cachedSourceZoneValue;
        }

        if(popupState.cachedTargetZoneInput && popupState.cachedTargetZoneValue) {
            DOM.targetZoneInput.value = popupState.cachedTargetZoneInput;
            DOM.targetZoneValue.value = popupState.cachedTargetZoneValue;
        }

        if(popupState.cachedHour && popupState.cachedMinute && popupState.cachedAMPM) {
            DOM.hourPicker.value = popupState.cachedHour;
            DOM.minutePicker.value = popupState.cachedMinute;
            DOM.ampmPicker.value = popupState.cachedAMPM;
        }

        if (popupState.timezoneOut) {
            DOM.timezoneDiv.textContent = popupState.timezoneOut;
        }

        if (popupState.tab) {
            const savedTabBtn = document.querySelector(`.navBtn[data-tab="${popupState.tab}"]`);
            savedTabBtn?.click();
        }

    } catch(error) {
        console.error("Failed to restore state:", error);
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
        const { timezone_now, cached_lat, cached_lng } = await storageLocal.get(["timezone_now", "cached_lat", "cached_lng"]);

        // check if user is in the same spot (approx 100m)
        const isSameLocation = cached_lat !== undefined &&
                               cached_lng !== undefined &&
                               Math.abs(latitude - cached_lat) < 0.001 &&
                               Math.abs(longitude - cached_lng) < 0.001;

        if (timezone_now && isSameLocation) {
            applyTimezoneUI(timezone_now);
            console.log("Loaded time zone from cache");
        } else {
            console.log("Fetching from server...");
            const data = await fetchTimezone(latitude, longitude);
            applyTimezoneUI(data);
        }
    } catch (error) {
        DOM.locationButton.classList.remove("loading");
        DOM.locationButton.textContent = "Error";
        console.error(error);
    }
}

async function handleTimezoneListRequest() {
    try {
        let { timezone_list } = await storageSession.get("timezone_list");
        if (timezone_list != null) {
            console.log("Loaded time zone list from cache");
        } else {
            console.log("Fetching Timezone List from server");
            timezone_list = await fetchTimezoneList();
        }

        // API returns { status: "OK", message: "", zones: [...] }, unwrap the array
        const list = timezone_list?.zones ?? [];

        initCustomDropdowns(list);
    } catch(error) {
        console.error(error);
    }
}

// FETCHES

function fetchTimezone(latitude, longitude) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "getTimezone", latitude, longitude }, (response) => {
            if (chrome.runtime.lastError || !response?.success) {
                console.error("Fetch failed: ", chrome.runtime.lastError || response?.error);
                DOM.locationButton.textContent = "Error";
                DOM.locationButton.classList.remove("loading");
                reject(chrome.runtime.lastError || new Error(response?.error || "Unknown error"));
                return;
            }
            const data = response.data;
            storageLocal.set({ timezone_now: data, cached_lat: latitude, cached_lng: longitude });
            console.log("Fetched successfully");
            resolve(data);
        });
    });
}

function fetchTimezoneList() {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "getTimezoneList" }, (response) => {
            if (chrome.runtime.lastError || !response?.success) {
                console.error("Fetch failed: ", chrome.runtime.lastError || response?.error);
                reject(chrome.runtime.lastError || new Error(response?.error || "Unknown error"));
                return;
            }
            const data = response.data;
            storageSession.set({ timezone_list: data });
            resolve(data);
        });
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

function initCustomDropdowns(timezones) {
    if (timezones.length === 0) {
        console.error("initCustomDropdowns: received no timezones", timezones);
        return;
    }

    // sort alphabetically
    const normalizedTimezones = [];

    // check if any empty or null strings
    for (const tz of timezones) {
        const zone = tz.zoneName;
        const country = tz.countryName;
        // grab last slash, pop everything before and replace every _ with a space.
        const city = zone.split("/").pop().replace(/_/g, " ");

        normalizedTimezones.push({label: `${city}, ${country}`, value: tz});
    }
    normalizedTimezones.sort((a, b) => a.label.localeCompare(b.label)); // sort normalized timezones, localeCompare for special characters

    console.log(`Dropdowns ready: ${normalizedTimezones.length} timezones`);

    setupTimezonePicker(DOM.sourceZoneInput, DOM.sourceZoneValue, DOM.sourceZoneList, normalizedTimezones);
    setupTimezonePicker(DOM.targetZoneInput, DOM.targetZoneValue, DOM.targetZoneList, normalizedTimezones);
}

/**
 * FUZZY / NEAREST-MATCH SEARCH
 * Scoring priority (highest → lowest):
 *   1. Exact match
 *   2. Starts with query
 *   3. A segment (after / or _) starts with query
 *   4. Contains query as a substring
 *   5. Levenshtein distance on the closest segment (catches typos)
 */
function fuzzySearchTimezones(timezones, query) {
    if (!query) return timezones; // empty → full alphabetical list

    const q = query.toLowerCase();

    // minimum num of edits needed to turn one string to another
    // https://www.geeksforgeeks.org/dsa/introduction-to-levenshtein-distance/
    function levenshtein(str1, str2) {
        const m = str1.length;
        const n = str2.length;
        // Initialize two arrays to represent the matrix rows
        let prevRow = new Array(n + 1).fill(0); // + 1 for empty string start
        let currRow = new Array(n + 1).fill(0);
        // cost of "" → "cut", one insertion per character, so just 0, 1, ... , n
        for (let j = 0; j <= n; j++) {
            prevRow[j] = j;
        }
        // Dynamic programming to fill the matrix
        for (let i = 1; i <= m; i++) {
            currRow[0] = i; // fill first column
            /**
             * c === c → diagonal = dp[0][0] = 0
             * c !== c → 1 + min(left, above, diag) = 1
             */
            for (let j = 1; j <= n; j++) {
                // Check if characters at the current positions are equal
                if (str1[i - 1] === str2[j - 1]) {
                    currRow[j] = prevRow[j - 1]; // No operation required
                } else {
                    // Choose the minimum of three possible operations (insert, remove, replace)
                    currRow[j] = 1 + Math.min(
                        currRow[j - 1],   // Insert (left)
                        prevRow[j],       // Remove (up)
                        prevRow[j - 1]    // Replace (diag)
                    );
                }
            }
            // Update the previous row with the current row for the next iteration
            for(let j = 0; j <= n; j++) {
                prevRow[j] = currRow[j];
            }
        }
        // The result is the value at the bottom-right corner of the matrix
        return currRow[n];
    }

    /**
     * get segments of each timezone and compare it to the query, return min
     */ 
    function bestSegmentDistance(tz, q) {
        return Math.min(...tz.toLowerCase().split(/[/_]/).map(seg => levenshtein(seg, q)));
    }

    /**
     * calculates the score of a timezone compared a query using the levenshtein algorithm
     * @param {String} tz : timezone
     * @returns score of a timezone against a query
     */
    function score(tz) {
        const lower = tz.toLowerCase();
        const segments = lower.split(/[/_]/);

        if (lower === q) return 0; // if the timezone is the query
        if (lower.startsWith(q)) return 1; // if the timezone literally starts with the query
        if (segments.some(s => s.startsWith(q))) return 2; // if any of the segments start with the query, separated by / or _
        if (lower.includes(q)) return 3; // if it even just includes the query

        const dist = bestSegmentDistance(tz, q); // if neither of those, then get segment distance from query via levenshtein algo
        const threshold = Math.max(2, Math.floor(q.length / 2)); // determines tolerance of the queries, longer the more tolerance
        if (dist <= threshold) return 4 + dist; // if within tolerance, then return 4 (lower prio) + the distance

        return Infinity; // else, its too far
    }

    // pipeline to score timezones
    return timezones
        .map(tz => ({ tz, s: score(tz.label) })) // attach a score to each timezone
        .filter(({ s }) => s < Infinity) // removes timezones that are beyond tolerance
        .sort((a, b) => a.s !== b.s ? a.s - b.s : a.tz.label.localeCompare(b.tz.label)) // sort by score, lower = better, if equal, sort by alphabetical
        .map(({ tz }) => tz); // extract the timezone strings from the objects
}

function setupTimezonePicker(inputEl, hiddenEl, listEl, timezones) {
    let filtered = [...timezones];
    let activeIndex = -1;

    function renderList(items) {
        listEl.innerHTML = ""; // clear

        if (items.length === 0) {
            listEl.innerHTML = `<div class="timezoneEmpty">No matching timezones</div>`;
            listEl.classList.add("show");
            return;
        }

        items.forEach((tzObj, index) => {
            const tz = tzObj.label;
            const option = document.createElement("div");
            option.className = "timezoneOption";

            const query = inputEl.value.trim(); // user input
            if (query) { // highlight
                const lower = tz.toLowerCase();
                const idx = lower.indexOf(query.toLowerCase());
                if (idx !== -1) {
                    option.innerHTML =
                        tz.slice(0, idx) +
                        `<mark>${tz.slice(idx, idx + query.length)}</mark>` +
                        tz.slice(idx + query.length);
                } else {
                    option.textContent = tz;
                }
            } else {
                option.textContent = tz;
            }

            if (index === activeIndex) option.classList.add("active"); // add green hue
            option.addEventListener("click", () => selectTimezone(tzObj));
            listEl.appendChild(option);
        });

        listEl.classList.add("show");
    }

    function selectTimezone(tz) {
        inputEl.value = tz.label;
        hiddenEl.value = JSON.stringify(tz.value);
        listEl.classList.remove("show");
        activeIndex = -1;
        savePopupState();
    }

    inputEl.addEventListener("focus", () => {
        setTimeout(() => {
            filtered = fuzzySearchTimezones(timezones, inputEl.value.trim());
            renderList(filtered);
        }, 100); // timer for 100ms to reduce twitching of the popup
    });

    inputEl.addEventListener("input", () => {
        hiddenEl.value = "";
        activeIndex = -1;
        filtered = fuzzySearchTimezones(timezones, inputEl.value.trim());
        renderList(filtered);
        savePopupState();
    });

    inputEl.addEventListener("keydown", (event) => {
        if (!listEl.classList.contains("show")) return;

        if (event.key === "ArrowDown") {
            event.preventDefault();
            activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
            renderList(filtered);
            listEl.querySelector(".timezoneOption.active")?.scrollIntoView({ block: "nearest" });
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            activeIndex = Math.max(activeIndex - 1, 0);
            renderList(filtered);
            listEl.querySelector(".timezoneOption.active")?.scrollIntoView({ block: "nearest" });
        }
        if (event.key === "Enter") {
            event.preventDefault();
            if (filtered[activeIndex]) selectTimezone(filtered[activeIndex]);
        }
    });

    document.addEventListener("click", (event) => {
        if (!inputEl.contains(event.target) && !listEl.contains(event.target)) {
            listEl.classList.remove("show");
            activeIndex = -1;
        }
    });
}

function setupTimePickerOptions() {
    // hours
    for(let i = 1; i <= 12; i++) {
        if(i < 10) {
            DOM.hourPicker.innerHTML += `<option> 0${i} </option>`
        } else {
            DOM.hourPicker.innerHTML += `<option> ${i} </option>`
        }
    }
    // minutes
    for(let i = 0; i < 60; i+= 5) {
        if(i < 10) {
            DOM.minutePicker.innerHTML += `<option> 0${i} </option>`
        } else {
            DOM.minutePicker.innerHTML += `<option> ${i} </option>`
        }
    }
}

// limitation: if you convert time at exactly where DST is affected and you did not quit/restart the extension session, it will still presume DST and vice versa.
function convertTime() {
    try {
        // ensure zones are selected
        if (!DOM.sourceZoneValue.value || !DOM.targetZoneValue.value) {
            DOM.convertOutput.textContent = "Please select both timezones.";
            return;
        }

        // parse inputs
        const sourceData = JSON.parse(DOM.sourceZoneValue.value);
        const targetData = JSON.parse(DOM.targetZoneValue.value);
        let hour = Number(DOM.hourPicker.value);
        const minute = Number(DOM.minutePicker.value);

        // normalize to 24-hour minutes (0 to 1439)
        if (DOM.ampmPicker.value === "PM" && hour !== 12) hour += 12;
        if (DOM.ampmPicker.value === "AM" && hour === 12) hour = 0;
        
        let currentTotalMinutes = (hour * 60) + minute;

        // calculate offset (gmtOffset is usually in seconds, convert to minutes)
        const offsetDiffMinutes = (targetData.gmtOffset - sourceData.gmtOffset) / 60;
        let targetTotalMinutes = currentTotalMinutes + offsetDiffMinutes;

        // determine Day Shift (-1, 0, or 1)
        // Math.floor handles negative numbers correctly for 'previous day'
        const dayShift = Math.floor(targetTotalMinutes / 1440);
        const dayLabels = { "-1": " (previous day)", "0": "", "1": " (next day)" };

        // wrap minutes to stay within a 24-hour loop (0-1439)
        const finalMinutes = ((targetTotalMinutes % 1440) + 1440) % 1440;

        // format Output (12-hour clock)
        const h24 = Math.floor(finalMinutes / 60);
        const m = String(finalMinutes % 60).padStart(2, "0");
        const ampm = h24 >= 12 ? "PM" : "AM";
        const h12 = (h24 % 12) || 12; // If 0, result is 12

        let UTCDisplacementSource = sourceData.gmtOffset / 3600;
        let UTCDisplacementTarget = targetData.gmtOffset / 3600;

        if(UTCDisplacementSource > 0) {
            UTCDisplacementSource = "+" + UTCDisplacementSource;
        }
        if(UTCDisplacementTarget > 0) {
            UTCDisplacementTarget = "+" + UTCDisplacementTarget;
        }

        DOM.convertOutput.innerHTML = `From: UTC${UTCDisplacementSource} to UTC${UTCDisplacementTarget} <br> ${h12}:${m} ${ampm}${dayLabels[dayShift] || ""}`;

    } catch (err) {
        console.error("Conversion failed:", err);
        DOM.convertOutput.textContent = "Error parsing timezone data.";
    }
}

function covertPastedTime() {
    
}

function init() {
    DOM.tabs.forEach((btn, index) => {
        btn.addEventListener("click", () => {
            DOM.tabs.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            DOM.slider.style.transform = `translateX(${index * 100}%)`;
            DOM.track.style.transform = `translateX(-${index * 50}%)`;
            savePopupState();
        });
    });

    DOM.textAreas.forEach(el => el.addEventListener("input", savePopupState));
    DOM.locationButton.addEventListener("click", handleLocationRequest);

    DOM.hourPicker.addEventListener("change", savePopupState);
    DOM.minutePicker.addEventListener("change", savePopupState);
    DOM.ampmPicker.addEventListener("change", savePopupState);

    DOM.convertButton.addEventListener("click", convertTime)

    setupTimePickerOptions();

    handleTimezoneListRequest();
    restoreState();
}

document.addEventListener("DOMContentLoaded", init);
