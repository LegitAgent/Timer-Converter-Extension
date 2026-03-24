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
     * prevents the striong from being interpreted as a RegEx by itself
     * @param {string} str a string of text
     * @returns {string} a safe string that can be parsed into RegEx
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
     * @returns 
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
        if (!parent) return true; // no parent = not normal html, detatached from DOM

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
     * @param {string | undefined} ampm
     * @returns {string | undefined}
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
     * @param {string} time
     * @param {string | undefined} ampm
     * @param {string} rawTimezone
     * @returns {boolean}
     */
    function isLikelyFalsePositive(time, ampm, rawTimezone) {
        if (/^\d{4}$/.test(time) && !ampm && /^(19|20)\d{2}$/.test(time)) {
            return true;
        }

        if (rawTimezone.length <= 2 && rawTimezone !== rawTimezone.toUpperCase()) {
            return true;
        }

        if (rawTimezone.toUpperCase() === "WT" && rawTimezone !== rawTimezone.toUpperCase()) {
            return true;
        }

        return false;
    }

    /**
     * find specific groups of strings in a block of text that match standard formatting (i.e. 10:30pm pst, 14:20 cest, etc.)
     * @param {string} text a block of text from a node
     * @returns {Object} key-value pairs of valid time matches
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

    function wrapMatch(matchText, convertedTime) {
        const wrapper = document.createElement("span");
        wrapper.className = "tz-highlight";
        wrapper.setAttribute("data-tz-processed", "true");
        wrapper.setAttribute("data-original-text", matchText);

        wrapper.append(document.createTextNode(matchText));

        const badge = document.createElement("span");
        badge.className = "tz-badge";
        badge.textContent = convertedTime;
        wrapper.append(badge);

        return wrapper;
    }

    function replaceNodeWithMatches(node, matches) {
        const text = node.nodeValue || "";
        const fragment = document.createDocumentFragment();
        let cursor = 0;

        for (const match of matches) {
            if (match.start < cursor) continue;
            if (!match.convertedTime) continue;

            if (match.start > cursor) {
                fragment.append(document.createTextNode(text.slice(cursor, match.start)));
            }

            fragment.append(wrapMatch(match.matchText, match.convertedTime));
            cursor = match.end;
        }

        if (cursor < text.length) {
            fragment.append(document.createTextNode(text.slice(cursor)));
        }

        node.parentNode?.replaceChild(fragment, node);
    }

    function createWalker(root) {
        return document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    return shouldSkipTextNode(node)
                        ? NodeFilter.FILTER_REJECT
                        : NodeFilter.FILTER_ACCEPT;
                }
            }
        );
    }

    function collectNodes(root) {
        const nodes = [];

        if (!root) return nodes;

        if (root.nodeType === Node.TEXT_NODE) {
            if (!shouldSkipTextNode(root)) {
                nodes.push(root);
            }
            return nodes;
        }

        if (!(root instanceof Element) && !(root instanceof Document) && !(root instanceof DocumentFragment)) {
            return nodes;
        }

        if (root instanceof Element && root.closest(SKIP_SELECTOR)) return nodes;
        if (root instanceof Element && root.closest("[data-tz-processed='true']")) return nodes;

        const walker = createWalker(root);
        let current;

        while ((current = walker.nextNode())) {
            nodes.push(current);
        }

        return nodes;
    }

    async function requestConversions(matchMap) {
        const uniqueItems = [];
        const seenKeys = new Set();

        for (const matches of matchMap.values()) {
            for (const match of matches) {
                if (seenKeys.has(match.key)) continue;
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

            response.results.forEach((item) => {
                results.set(item.key, item.convertedTime);
            });

            return results;
        } catch (error) {
            console.error("Failed to convert detected times.", error);
            return new Map();
        }
    }

    async function scanPage(root = document.body) {
        if (!isEnabled || !document.body || !matchRegex) return;

        injectStyles();

        const nodes = collectNodes(root);
        if (!nodes.length) return;

        const matchMap = new Map();
        for (const node of nodes) {
            const matches = findTimeMatches(node.nodeValue || "");
            if (matches.length) {
                matchMap.set(node, matches);
            }
        }

        if (!matchMap.size) return;

        const conversions = await requestConversions(matchMap);
        if (!conversions.size) return;

        for (const [node, matches] of matchMap.entries()) {
            const enrichedMatches = matches
                .map((match) => ({
                    ...match,
                    convertedTime: conversions.get(match.key) || null
                }))
                .filter((match) => match.convertedTime);

            if (enrichedMatches.length) {
                replaceNodeWithMatches(node, enrichedMatches);
            }
        }

        initObserver();
    }

    function clearProcessedNodes() {
        document.querySelectorAll(".tz-highlight[data-tz-processed='true']").forEach((node) => {
            const originalText = node.getAttribute("data-original-text") || "";
            node.replaceWith(document.createTextNode(originalText));
        });
    }

    function disconnectObserver() {
        if (!observer) return;
        observer.disconnect();
        observer = null;
    }

    function scheduleScan(root = document.body) {
        if (!isEnabled) return;

        if (scanTimer) {
            clearTimeout(scanTimer);
        }

        scanTimer = window.setTimeout(() => {
            scanTimer = null;
            void scanPage(root);
        }, 150);
    }

    function initObserver() {
        if (observer || !document.body) return;

        observer = new MutationObserver((mutations) => {
            if (!isEnabled) return;

            for (const mutation of mutations) {
                if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
                    scheduleScan(mutation.target);
                    return;
                }

                if (mutation.type === "characterData") {
                    scheduleScan(mutation.target.parentNode || document.body);
                    return;
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    function clearHighlights() {
        if (scanTimer) {
            clearTimeout(scanTimer);
            scanTimer = null;
        }

        disconnectObserver();
        clearProcessedNodes();
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message || typeof message !== "object" || typeof message.type !== "string") {
            return;
        }

        switch (message.type) {
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

            case "TIME_EXTENSION_SCAN_PAGE":
                if (isEnabled) {
                    clearProcessedNodes();
                    void scanPage();
                }

                sendResponse?.({ success: true });
                return true;

            case "TIME_EXTENSION_CLEAR_HIGHLIGHTS":
                clearHighlights();
                sendResponse?.({ success: true });
                return true;

            default:
                return;
        }
    });
})();
