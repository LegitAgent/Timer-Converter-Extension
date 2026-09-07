// (() => means: make an anonymous function and execute it immediately.
(() => {
    if (window.__timeExtensionScannerLoaded) return; // check if this script has been loaded for this tab
    window.__timeExtensionScannerLoaded = true;

    const STYLE_ID = "time-extension-inline-style";
    const SKIP_SELECTOR = "input, textarea, select, script, style, noscript, svg, math, [contenteditable]:not([contenteditable='false'])";
    const TIME_PATTERN = String.raw`(?:\d{1,2}:\d{2}|\d{3,4}|\d{1,2})`;
    const AMPM_PATTERN = String.raw`(?:A\.?M\.?|P\.?M\.?)`;
    const CASE_SENSITIVE_TIMEZONES = new Set([
        "AT",
        "ACT",
        "ART",
        "AST",
        "CAT",
        "EAT",
        "GET",
        "PET",
        "WAT",
        "WET"
    ]);
    
    let timezoneOffsets = null;
    let matchRegex = null;
    let isEnabled = false;
    let observer = null;
    let scanTimer = null;
    let scanGeneration = 0;
    let settingsKey = null;
    let conversionError = null;
    const pendingRoots = new Set();

    /**
     * prevents the string from being interpreted as a regex by itself
     * @param {string} str a string of text
     * @returns {string} a safe string that can be parsed into a regex
     */
    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    /**
     * creates the style for elements that need highlighting
     * @returns {void}
     */
    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            .tz-highlight {
                display: inline;
                margin: 0;
                padding: 0;
                border: 0;
                border-radius: 0;
                background: rgba(255, 230, 150, 0.4);
                box-shadow: none;
                font: inherit;
                color: inherit;
            }

            .tz-source {
                font-weight: inherit;
                color: inherit;
                letter-spacing: 0;
            }

            .tz-divider {
                display: inline;
                margin: 0 0.06em 0 0.18em;
                padding: 0;
                background: transparent;
                color: #64748b;
                font-size: 1em;
                font-weight: inherit;
            }

            .tz-badge {
                display: inline;
                padding: 0.08em 0.42em;
                border-radius: 999px;
                background: #111827;
                color: #ffffff;
                white-space: nowrap;
                vertical-align: baseline;
                font-size: 0.95em;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
                font-style: normal;
            }

            .tz-badge-label {
                color: inherit;
                font-size: 0.95em;
                font-weight: inherit;
                text-transform: none;
                letter-spacing: 0;
            }

            .tz-badge-value {
                font-weight: inherit;
                letter-spacing: 0;
                color: inherit;
            }
        `;

        document.documentElement.appendChild(style);
    }

    /**
     * builds a regex that matches all formats of time to be highlighted and detected by the extension
     * @returns {RegExp | null}
     */
    function buildMatchRegex() {
        if (!timezoneOffsets) return null;

        const timezoneKeys = Object.keys(timezoneOffsets) // get only keys
            .map((key) => key.toUpperCase())
            .filter((key) => key.length > 1) // filter keys with only signle letter, i.e. military times
            .sort((a, b) => b.length - a.length) // sort by length
            .map(escapeRegex); // treat as literals if the key has regex interpretable characters

        // match every single key into a pipe (e.g. PST | ET | CEST ...)
        const timezonePattern = `(?:${timezoneKeys.join("|")})`;
        
        // string.raw for raw text i.e. no \n
        // format: match must not be immediately preceded by a letter, digit, or underscore
        //         create capture group, named as <full>
        //         name the group time and use TIME_PATTERN regex, similar with ampm and tz
        //         match must not be immediately followed by a letter, digit, or underscore
        // e.g., abcd10AMPST (*)abcd is invalid since it is stuck between a word, it must be a word in itself
        return new RegExp(
            String.raw`(?<![A-Za-z0-9_:])(?<full>(?<time>${TIME_PATTERN})\s*(?<ampm>${AMPM_PATTERN})?\s*(?<tz>${timezonePattern}))(?![A-Za-z0-9_]|[+-]\d|:\d)`,
            "gi"
        );
    }

    /**
     * checks to see if the time is valid and gets its corresponding hours and minutes if possible.
     * @param {string} time a string for the time section
     * @param {string} ampm a string for the ampm section
     * @returns {(Object | Boolean)} an Object literal if valid, otherwise false
     */
    function getHoursAndMinutes(time, ampm) {
        let hours = 0;
        let minutes = 0;

        if (time.includes(":")) {
            if (!/^\d{1,2}:\d{2}$/.test(time)) return false;

            const parts = time.split(":");
            hours = parts[0];
            minutes = parts[1];
        } else {
            const length = time.length;

            if (length === 1 || length === 2) {
                hours = time;
            } else if (length === 3) {
                hours = time.charAt(0);
                minutes = time.slice(1);
            } else if (length === 4) {
                hours = time.slice(0, 2);
                minutes = time.slice(2);
            } else {
                return false;
            }
        }

        hours = Number(hours);
        minutes = Number(minutes);

        if (Number.isNaN(hours) || Number.isNaN(minutes)) return false;
        if (minutes < 0 || minutes >= 60) return false;

        if (ampm) {
            const upperAMPM = normalizeAMPM(ampm);

            if (hours < 1 || hours > 12) return false;

            if (upperAMPM === "AM") {
                if (hours === 12) hours = 0;
            } else if (upperAMPM === "PM") {
                if (hours !== 12) hours += 12;
            } else {
                return false;
            }
        } else if (hours < 0 || hours > 23) {
            return false;
        }

        return { hours, minutes };
    }

    /**
     * normalizes supported AM/PM inputs such as AM, PM, a.m., and p.m.
     * @param {string | undefined} ampm a string ampm field
     * @returns {string | undefined} a normalized ampm field
     */
    function normalizeAMPM(ampm) {
        if (typeof ampm !== "string") return undefined;

        const normalized = ampm.trim().replace(/\./g, "").toUpperCase();
        if (normalized === "AM" || normalized === "PM") {
            return normalized;
        }

        return ampm.toUpperCase();
    }

    /**
     * reject match patterns that are technically parseable but very likely to be
     * ordinary prose or year values rather than real timezone mentions.
     * @param {string} time a string time
     * @param {string | undefined} ampm a string ampm field
     * @param {string} rawTimezone a string raw time zone input
     * @returns {boolean} if it is a false positive
     */
    function isLikelyFalsePositive(time, ampm, rawTimezone) {
        // if token is exactly 4 digits, there is no ampm, and looks like a year from 1900-2099
        if (/^\d{4}$/.test(time) && !ampm && /^(19|20)\d{2}$/.test(time)) {
            return true;
        }

        // for AT != at (e.g., Atlantic Time != "at")
        if (rawTimezone.length <= 2 && rawTimezone !== rawTimezone.toUpperCase()) {
            return true;
        }

        // some timezone abbreviations are also common English words
        // treat those as valid only when the page text uses their uppercase form
        if (CASE_SENSITIVE_TIMEZONES.has(rawTimezone.toUpperCase()) && rawTimezone !== rawTimezone.toUpperCase()) {
            return true;
        }

        // only allowing like "2 PM AT" or "2:00 AT" for timezones that are also common English words
        if (
            CASE_SENSITIVE_TIMEZONES.has(rawTimezone.toUpperCase()) &&
            !time.includes(":") &&
            !ampm
        ) {
            return true;
        }

        return false;
    }

    /**
     * find specific groups of strings in a block of text that match standard formatting (i.e. 10:30pm pst, 14:20 cest, etc.)
     * @param {string} text a block of text from a node
     * @returns {Array} array of key-value pairs of valid time matches
     */
    function findTimeMatches(text) {
        if (!text || !matchRegex) return [];

        const matches = [];
        matchRegex.lastIndex = 0; // char pos where next search begins

        let match;
        while ((match = matchRegex.exec(text)) !== null) {
            const matchText = match.groups?.full || match[0];
            const time = match.groups?.time || "";
            const ampm = normalizeAMPM(match.groups?.ampm || "");
            const rawTimezone = match.groups?.tz || "";
            const timezone = rawTimezone.toUpperCase();

            // filters
            if (!timezone || !time) continue;
            if (isLikelyFalsePositive(time, ampm || undefined, rawTimezone)) continue;
            if (!(timezone in timezoneOffsets)) continue;
            if (!getHoursAndMinutes(time, ampm || undefined)) continue;

            matches.push({
                start: match.index,
                end: match.index + matchText.length,
                matchText,
                time,
                ampm: ampm || undefined,
                timezone,
                key: `${time}|${ampm || ""}|${timezone}`
            });
        }

        return matches;
    }

    /**
     * wraps the match with a marker and a highlight style, and appends a badge showing
     * the converted time
     * @param {string} matchText the whole matched string of text
     * @param {string} convertedTime the converted local time of the matched text
     * @returns {HTMLSpanElement} the wrapper element containing the original text and badge
     */
    function wrapMatch(matchText, convertedTime) {
        const wrapper = document.createElement("span");
        wrapper.className = "tz-highlight";
        wrapper.setAttribute("data-tz-processed", "true"); // marker
        wrapper.setAttribute("data-original-text", matchText); // orig text to store for undoing

        const source = document.createElement("span");
        source.className = "tz-source";
        source.textContent = matchText;
        wrapper.append(source);

        // Split expressions retain a highlight in each original element, with
        // just one conversion badge after the last part.
        if (!convertedTime) return wrapper;

        const divider = document.createElement("span");
        divider.className = "tz-divider";
        divider.textContent = "(";
        wrapper.append(divider);

        const badge = document.createElement("span");
        badge.className = "tz-badge";

        const badgeLabel = document.createElement("span");
        badgeLabel.className = "tz-badge-label";
        badgeLabel.textContent = "local ";
        badge.append(badgeLabel);

        const badgeValue = document.createElement("span");
        badgeValue.className = "tz-badge-value";
        badgeValue.textContent = convertedTime;
        badge.append(badgeValue);

        const badgeClose = document.createElement("span");
        badgeClose.className = "tz-badge-label";
        badgeClose.textContent = ")";
        badge.append(badgeClose);

        wrapper.append(badge);

        return wrapper;
    }

    /**
     * replaces the matched text node with text fragments and wrapped matches
     * @param {Node} node original text node in the DOM
     * @param {Array} matches detected matches in the text node
     */
    function replaceNodeWithMatches(node, matches) {
        const text = node.nodeValue || "";
        const fragment = document.createDocumentFragment(); // temp DOM container
        let cursor = 0; // tracker for original text string

        for (const match of matches) {
            if (match.start < cursor) continue; // skip if already handled

            // preserve the plain text before this match, if any
            if (match.start > cursor) {
                fragment.append(document.createTextNode(text.slice(cursor, match.start)));
            }

            fragment.append(wrapMatch(match.matchText, match.convertedTime));
            cursor = match.end; // move cursor to match end
        }

        // check for leftovers after the last match
        if (cursor < text.length) {
            fragment.append(document.createTextNode(text.slice(cursor)));
        }
        
        // replace node with fragment we built
        node.parentNode?.replaceChild(fragment, node);
    }

    function isInline(element) {
        return ["inline", "contents"].includes(window.getComputedStyle(element).display);
    }

    function isExcluded(element) {
        const style = window.getComputedStyle(element);
        return element.matches(SKIP_SELECTOR + ", [data-tz-processed='true']") ||
            style.display === "none" || ["hidden", "collapse"].includes(style.visibility);
    }

    // Preserve whitespace and offsets across inline formatting, but never join
    // separate blocks or bridge excluded/hidden content.
    function collectTextRuns(root) {
        // A queued subtree may sit inside a hidden or editable ancestor.
        for (let parent = root.parentElement; parent; parent = parent.parentElement) {
            if (isExcluded(parent)) return [];
        }
        const runs = [];
        let run = { text: "", parts: [] };
        const flush = () => {
            if (run.parts.length) runs.push(run);
            run = { text: "", parts: [] };
        };
        function visit(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                if (!node.nodeValue) return;
                // Whitespace-only nodes are essential between inline elements.
                run.parts.push({ node, text: node.nodeValue, start: run.text.length });
                run.text += node.nodeValue;
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            if (isExcluded(node) || ["BR", "HR", "IMG", "IFRAME"].includes(node.tagName)) {
                flush();
                return;
            }
            const boundary = !isInline(node);
            if (boundary) flush();
            for (const child of node.childNodes) visit(child);
            if (boundary) flush();
        }
        visit(root);
        flush();
        return runs;
    }

    /**
     * deduplicates detected matches and requests converted times from the background script
     * @param {Map<Object, Array>} matchMap matches grouped by inline text run
     * @returns {Promise<Map<string, string>>} a map of converted times as values and match keys as keys
     */
    async function requestConversions(matchMap) {
        const generation = scanGeneration;
        const uniqueItems = [];
        const seenKeys = new Set();

        // node -> arr of matches -> per match
        for (const matches of matchMap.values()) {
            for (const match of matches) {
                if (seenKeys.has(match.key)) continue; // deduplicates existing conversions (e.g. 10:30 PST 10 times = one stored 10:30 PST)
                seenKeys.add(match.key);
                uniqueItems.push({
                    key: match.key,
                    time: match.time,
                    ampm: match.ampm,
                    timezone: match.timezone
                });
            }
        }

        if (!uniqueItems.length) return new Map();

        try {
            const response = await chrome.runtime.sendMessage({
                action: "convertDetectedTimes",
                items: uniqueItems
            });
            if (generation !== scanGeneration || !isEnabled) return new Map();

            const results = new Map();
            if (!response?.success || !Array.isArray(response.results)) {
                conversionError = response?.error || "Unable to convert detected times. Try turning the scanner off and on.";
                return results;
            }
            conversionError = null;

            // parse conversions into a map
            response.results.forEach((item) => {
                results.set(item.key, item.convertedTime);
            });

            return results;
        } catch (error) {
            if (generation !== scanGeneration || !isEnabled) return new Map();
            conversionError = "Unable to reach the extension. Refresh this page and try again.";
            console.error("Failed to convert detected times.", error);
            return new Map();
        }
    }

    /**
     * scans a page and replaces matched time zones with attached badges converted to the user's local time zone
     * and adds a MutationObserver to the DOM
     * @param {Node} root root node of the page
     * @returns {void}
     */
    async function scanPage(root = document.body) {
        if (!isEnabled || !document.body || !matchRegex) return;

        injectStyles();
        // Observe even when this page has no matches yet or conversion fails.
        initObserver();
        const generation = scanGeneration;

        const runs = collectTextRuns(root);

        // get all standard format matches in all collected text nodes
        const matchMap = new Map();
        for (const run of runs) {
            const matches = findTimeMatches(run.text);
            if (matches.length) {
                matchMap.set(run, matches);
            }
        }

        if (!matchMap.size) return;

        // convert the map of matches and store it via key-value pairs 
        const conversions = await requestConversions(matchMap);
        if (!conversions.size || !isEnabled || generation !== scanGeneration) return;

        // Recheck DOM structure too: unchanged text may have moved to another block.
        const currentRuns = collectTextRuns(root);
        handleMutations(observer?.takeRecords() || []);
        observer?.disconnect();
        try {
            for (const [run, matches] of matchMap) {
                const unchanged = currentRuns.some((current) => current.text === run.text &&
                    current.parts.length === run.parts.length && current.parts.every((part, index) =>
                        part.node === run.parts[index].node && part.node.isConnected));
                if (!unchanged) continue;
                for (const part of run.parts) {
                    const pieces = matches.filter((match) => conversions.get(match.key) &&
                        match.start < part.start + part.text.length && match.end > part.start)
                        .map((match) => {
                            const start = Math.max(0, match.start - part.start);
                            const end = Math.min(part.text.length, match.end - part.start);
                            return { start, end, matchText: part.text.slice(start, end),
                                convertedTime: match.end <= part.start + part.text.length ? conversions.get(match.key) : null };
                        });
                    if (pieces.length) replaceNodeWithMatches(part.node, pieces);
                }
            }
        } finally {
            observer?.observe(document.body, { childList: true, subtree: true, characterData: true });
        }

    }

    /**
     * clear all nodes that were scanned and appended to the DOM
     */
    function clearProcessedNodes() {
        handleMutations(observer?.takeRecords() || []);
        observer?.disconnect();
        const parents = new Set();
        document.querySelectorAll(".tz-highlight[data-tz-processed='true']").forEach((node) => {
            parents.add(node.parentNode);
            const originalText = node.getAttribute("data-original-text") || "";
            node.replaceWith(document.createTextNode(originalText));
        });
        parents.forEach((parent) => parent?.normalize());
        observer?.observe(document.body, { childList: true, subtree: true, characterData: true });
    }

    /**
     * disconnects the mutation observer from the DOM
     * @returns {void}
     */
    function disconnectObserver() {
        if (!observer) return;
        observer.disconnect();
        observer = null;
    }

    /**
     * schedule a debounced page scan covering all changes in the batch
     * used to rescan dynamically updated content without doing it on every update
     * @returns {void}
     */
    function scheduleScan(root = document.body) {
        if (!isEnabled) return;
        if (root?.nodeType === Node.TEXT_NODE) root = root.parentElement;
        while (root && root !== document.body && isInline(root)) root = root.parentElement;
        if (!root?.isConnected) return;
        for (const pending of pendingRoots) {
            if (pending.contains(root)) return;
            if (root.contains(pending)) pendingRoots.delete(pending);
        }
        pendingRoots.add(root);
        if (scanTimer) return;

        // sets a debounce timer to limit to reduce scans
        scanTimer = window.setTimeout(() => {
            scanTimer = null;
            const roots = [...pendingRoots];
            pendingRoots.clear();
            for (const pending of roots) if (pending.isConnected) void scanPage(pending);
        }, 150);
    }

    /**
     * initializes the mutation observer
     * @returns {void}
     */
    function initObserver() {
        if (observer || !document.body) return;

        observer = new MutationObserver(handleMutations);

        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }

    function handleMutations(mutations) {
        if (!isEnabled) return;
        for (const mutation of mutations) {
            const parent = mutation.target.nodeType === Node.TEXT_NODE
                ? mutation.target.parentElement
                : mutation.target;
            if (parent?.closest?.("[data-tz-processed='true']")) continue;
            if (mutation.type === "childList" || mutation.type === "characterData") {
                scheduleScan(mutation.target);
            }
        }
    }

    /**
     * clears and removes the highlight styles from the DOM and disconnects the mutation observer
     */
    function clearHighlights() {
        pendingRoots.clear();
        if (scanTimer) {
            clearTimeout(scanTimer);
            scanTimer = null;
        }

        disconnectObserver();
        clearProcessedNodes();
    }

    /**
     * Pipeline Summary:
     * 1. Load content script.
     * 2. Receive timezone dictionary.
     * 3. Build regex from timezone keys.
     * 4. Receive enabled state.
     * 5. Start scan.
     * 6. Traverse DOM, respecting block and excluded-subtree boundaries.
     * 7. Collect eligible runs of inline text and their original text nodes.
     * 9. Extract named groups from each regex hit.
     * 10. Filter false positives.
     * 11. Validate timezone and time structure.
     * 12. Group matches by text run.
     * 15. Merge converted results back into matches.
     * 16. Replace original text nodes with fragments containing highlighted spans.
     * 17. Observe DOM mutations and rescan new content.
     * 18. Restore original text when disabled.
     */
    // listens for messages from background.js to
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message || typeof message !== "object" || typeof message.type !== "string") {
            return;
        }

        switch (message.type) {
            case "TIME_EXTENSION_GET_STATUS":
                sendResponse?.({ enabled: isEnabled, error: conversionError });
                return;
            // setup and build the time zone offset dictionary and scan again if it was already scanned previously
            // happens when syncing/updating a page
            case "TIME_EXTENSION_SET_OFFSETS":
                if (!message.offsets || typeof message.offsets !== "object") {
                    sendResponse?.({ success: false });
                    return;
                }

                const nextKey = JSON.stringify([
                    Object.entries(message.offsets).sort(([a], [b]) => a.localeCompare(b)),
                    message.localTimezone?.zoneName || null,
                    message.localTimezone?.gmtOffset ?? null
                ]);
                if (nextKey === settingsKey) {
                    sendResponse?.({ success: true });
                    return;
                }
                settingsKey = nextKey;
                conversionError = null;
                timezoneOffsets = message.offsets;
                scanGeneration++;
                matchRegex = buildMatchRegex();

                if (isEnabled) {
                    clearProcessedNodes();
                    scheduleScan();
                }

                sendResponse?.({ success: true });
                return true;
            
            // setup the scanning process and highlight if enables and vice versa
            // turns scanning/highlighting on or off
            case "TIME_EXTENSION_TOGGLE":
                if (typeof message.enabled !== "boolean") {
                    sendResponse?.({ success: false });
                    return;
                }

                if (isEnabled === message.enabled) {
                    sendResponse?.({ success: true });
                    return;
                }
                isEnabled = message.enabled;
                conversionError = null;
                scanGeneration++;

                if (!isEnabled) {
                    clearHighlights();
                    sendResponse?.({ success: true });
                    return true;
                }

                void scanPage();
                sendResponse?.({ success: true });
                return true;

            default:
                return;
        }
    });
})();
