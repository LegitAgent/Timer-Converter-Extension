import { DOM } from "./dom.js";
import { savePopupState } from "./manageState.js";

/**
 * FUZZY / NEAREST-MATCH SEARCH
 * Scoring priority (highest → lowest):
 *   1. Exact match
 *   2. Starts with query
 *   3. A segment (after / or _) starts with query
 *   4. Contains query as a substring
 *   5. Levenshtein distance on the closest segment (catches typos)
 */

/**
 * scores a list of words given some query, the score is calculated using levenshtein algorithm.
 * @param {Array} timezones an array of time zones
 * @param {string} query a string query
 * @returns {Object} an array of time zones with their corresponding scores
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
     * @param {string} tz country time zone name
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

/**
 * initializes the time zone picker dropdown and its event listeners.
 * @param {Element} inputEl an input tag for the user to search and place their queries in
 * @param {Element} hiddenEl a hidden input tag for storing values
 * @param {Element} listEl a div tag for displaying a list of time zones
 * @param {Object} timezones an array of time zones with key-value pairs of display name and values (e.g. abbreviations, city name, gmt offset, etc.)
 */
export function setupTimezonePicker(inputEl, hiddenEl, listEl, timezones) {
    let filtered = [...timezones];
    let activeIndex = -1;

    /**
     * renders a list of items and adds styling for highlighting similar words to the query and adding hues to selected time zones.
     * @param {Object} items an array of time zones with key-value pairs of display name and values (e.g. abbreviations, city name, gmt offset, etc.)
     * @returns nothing if there are no time zones to show
     */
    function renderList(items) {
        listEl.replaceChildren(); // clear

        if (items.length === 0) {
            const empty = document.createElement("div");
            empty.className = "timezoneEmpty";
            empty.textContent = "No matching timezones";
            listEl.appendChild(empty);
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
                    const before = tz.slice(0, idx);
                    const match = tz.slice(idx, idx + query.length);
                    const after = tz.slice(idx + query.length);
                    const mark = document.createElement("mark");

                    mark.textContent = match;
                    option.append(before, mark, after);
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

    /**
     * selects a time zone and saves its value to the hidden and displayed inputs. Also removes the list after picking a time zone.
     * @param {string} tz country time zone name
     */
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

/**
 * initializes the custom drop down by displaying and unwrapping the json object from the fetch and passes it on to the source and target zone inputs.
 * @param {Object} timezones an array of time zones with key-value pairs of display name and values (e.g. abbreviations, city name, gmt offset, etc.)
 * @returns nothing if there are no time zones to show
 */
export function initCustomDropdowns(timezones) {
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
