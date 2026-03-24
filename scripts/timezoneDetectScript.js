// (() => means: make an anonymous function and execute it immediately.
(() => {
    if (window.__timeExtensionScannerLoaded) return; // check if this script has been loaded for this tab
    window.__timeExtensionScannerLoaded = true;

    const STYLE_ID = "time-extension-inline-style";
    const SKIP_SELECTOR = "input, textarea, script, style, [contenteditable='true']";
    const TIME_PATTERN = String.raw`(?:\d{1,2}:\d{2}|\d{3,4}|\d{1,2})`;
    const AMPM_PATTERN = String.raw`(?:A\.?M\.?|P\.?M\.?)`;

    let timezoneOffsets = null;
    let matchRegex = null;
    let isEnabled = false;
    let observer = null;
    let scanTimer = null;

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
                background: rgba(255, 230, 150, 0.4);
                border-radius: 4px;
                padding: 2px 4px;
            }

            .tz-badge {
                margin-left: 6px;
                font-size: 0.75em;
                color: white;
                background: #333;
                padding: 2px 6px;
                border-radius: 10px;
                white-space: nowrap;
                display: inline-block;
                vertical-align: middle;
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
        // e.g., abcd10AMPSTabcd is invalid since it is stuck between a word, it must be a word in itself
        return new RegExp(
            String.raw`(?<![A-Za-z0-9_])(?<full>(?<time>${TIME_PATTERN})\s*(?<ampm>${AMPM_PATTERN})?\s*(?<tz>${timezonePattern}))(?![A-Za-z0-9_])`,
            "gi"
        );
    }

    /**
     * checks whether or not a specific node is supposed to be skipped by the scanner
     * @param {Node} node a node element in the DOM
     * @returns {Boolean} whether to skip the node or not
     */
    function shouldSkipTextNode(node) {
        if (!node || node.nodeType !== Node.TEXT_NODE) return true; // skip non-text nodes
        if (!node.nodeValue || !node.nodeValue.trim()) return true; // skip empty text nodes

        const parent = node.parentElement;
        if (!parent) return true; // no parent = not normal html, detached from the DOM

        // skip elements that are editable
        if (parent.closest(SKIP_SELECTOR)) return true;
        if (parent.closest("[data-tz-processed='true']")) return true; // skip already marked elements

        if (parent.isContentEditable || parent.closest("[contenteditable]:not([contenteditable='false'])")) {
            return true;
        }

        // skip elements that are not visible
        const styles = window.getComputedStyle(parent);
        if (styles.display === "none" || styles.visibility === "hidden") return true;

        return false;
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

        wrapper.append(document.createTextNode(matchText));

        const badge = document.createElement("span");
        badge.className = "tz-badge";
        badge.textContent = convertedTime;
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
            if (!match.convertedTime) continue;

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

    /**
     * creates a tree walker to navigate the DOM for eligible nodes to be scanned
     * @param {Node} root root node for the subtree
     * @returns {TreeWalker} a TreeWalker filtered by shouldSkipTextNode
     */
    function createWalker(root) {
        return document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT, // nodes that have text
            {
                acceptNode(node) {
                    return shouldSkipTextNode(node)
                        ? NodeFilter.FILTER_REJECT
                        : NodeFilter.FILTER_ACCEPT;
                }
            }
        );
    }

    /**
     * collects all nodes from the root DOM
     * @param {Node} root the root node of the DOM
     * @returns {Array} collected text nodes from the root node
     */
    function collectNodes(root) {
        const nodes = [];

        if (!root) return nodes;

        // if root is text by itself, needed because of mutation observer rescans
        if (root.nodeType === Node.TEXT_NODE) {
            if (!shouldSkipTextNode(root)) {
                nodes.push(root);
            }
            return nodes;
        }

        // only supported node types
        if (!(root instanceof Element) && !(root instanceof Document) && !(root instanceof DocumentFragment)) {
            return nodes;
        }

        // if already inside a skipped subtree
        if (root instanceof Element && root.closest(SKIP_SELECTOR)) return nodes;
        if (root instanceof Element && root.closest("[data-tz-processed='true']")) return nodes;

        const walker = createWalker(root);
        let current;

        // traverse nodes in the DOM
        while ((current = walker.nextNode())) {
            nodes.push(current);
        }

        return nodes;
    }

    /**
     * deduplicates detected matches and requests converted times from the background script
     * @param {Map<Node, Array>} matchMap a map of matched formats for scanning
     * @returns {Promise<Map<string, string>>} a map of converted times as values and match keys as keys
     */
    async function requestConversions(matchMap) {
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

            const results = new Map();
            if (!response?.success || !Array.isArray(response.results)) {
                return results;
            }

            // parse conversions into a map
            response.results.forEach((item) => {
                results.set(item.key, item.convertedTime);
            });

            return results;
        } catch (error) {
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

        const nodes = collectNodes(root);
        if (!nodes.length) return;

        // get all standard format matches in all collected text nodes
        const matchMap = new Map();
        for (const node of nodes) {
            const matches = findTimeMatches(node.nodeValue || "");
            if (matches.length) {
                matchMap.set(node, matches);
            }
        }

        if (!matchMap.size) return;

        // convert the map of matches and store it via key-value pairs 
        const conversions = await requestConversions(matchMap);
        if (!conversions.size) return;

        // get all eligible scanned time formats and add a badge that has the locally converted time
        for (const [node, matches] of matchMap.entries()) {
            // enriched = old time zone + new local time badge
            // add existing match attribs and add convertedTime attrib
            const enrichedMatches = matches
                .map((match) => ({
                    ...match,
                    convertedTime: conversions.get(match.key) || null
                }))
                .filter((match) => match.convertedTime); // for only successful conversions

            if (enrichedMatches.length) {
                replaceNodeWithMatches(node, enrichedMatches); // add styling and replace node
            }
        }

        initObserver(); // adds mutation observer
    }

    /**
     * clear all nodes that were scanned and appended to the DOM
     */
    function clearProcessedNodes() {
        document.querySelectorAll(".tz-highlight[data-tz-processed='true']").forEach((node) => {
            const originalText = node.getAttribute("data-original-text") || "";
            node.replaceWith(document.createTextNode(originalText));
        });
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
     * schedule a debounced page scan for a given root node
     * used to rescan dynamically updated content without doing it on every update
     * @param {Node} root the root to be scanned from the DOM
     * @returns {void}
     */
    function scheduleScan(root = document.body) {
        if (!isEnabled) return;

        if (scanTimer) {
            clearTimeout(scanTimer);
        }

        // sets a debounce timer to limit to reduce scans
        scanTimer = window.setTimeout(() => {
            scanTimer = null;
            void scanPage(root);
        }, 150);
    }

    /**
     * initializes the mutation observer
     * @returns {void}
     */
    function initObserver() {
        if (observer || !document.body) return;

        observer = new MutationObserver((mutations) => {
            if (!isEnabled) return;

            // loop through every DOM change in the callback batch
            for (const mutation of mutations) {
                // structural DOM change (new nodes added (e.g., <div>, <p>, element nodes))
                if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
                    scheduleScan(mutation.target);
                    return;
                }

                // text node changes (e.g., 10am to 10pm), edits to text
                if (mutation.type === "characterData") {
                    scheduleScan(mutation.target.parentNode || document.body);
                    return;
                }
            }
        });

        // watch list
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    /**
     * clears and removes the highlight styles from the DOM and disconnects the mutation observer
     */
    function clearHighlights() {
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
     * 6. Traverse DOM with TreeWalker.
     * 7. Collect eligible text nodes only.
     * 9. Extract named groups from each regex hit.
     * 10. Filter false positives.
     * 11. Validate timezone and time structure.
     * 12. Group matches by original text node.
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
            // setup and build the time zone offset dictionary and scan again if it was already scanned previously
            // happens when syncing/updating a page
            case "TIME_EXTENSION_SET_OFFSETS":
                if (!message.offsets || typeof message.offsets !== "object") {
                    sendResponse?.({ success: false });
                    return;
                }

                timezoneOffsets = message.offsets;
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

                isEnabled = message.enabled;

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
