# Time Converter Extension

A Chrome Extension that helps you work with time zones in three different ways:

- detect time strings on webpages and show local-time badges beside them
- paste a time plus timezone and convert it to your local timezone
- manually convert between any two time zones from the popup

The project is built with Manifest V3 and uses a popup UI, a background service worker, and a manifest-declared content script.
The projecy also uses a cloudflare wrangler for serverless and quick retrieval from API endpoints.

## Features

- Automatic page detection for common formats such as `10:30 PST`, `1430 CET`, and `10:30 a.m. EST`
- Inline local-time badges for detected page times
- MutationObserver support for dynamic sites that load content after the first render
- Paste-and-convert flow for quick one-off timezone conversions
- Manual timezone-to-timezone converter with searchable dropdowns
- Optional location-based timezone detection
- Local/session storage for popup state and cached timezone data

## How It Works

### Popup

The popup provides:

- location detection for your local timezone
- a manual converter between source and target time zones
- a paste-and-convert tool
- an extension toggle for automatic webpage scanning

### Background Service Worker

The background script:

- handles timezone API requests
- converts detected page times into the user’s local timezone
- syncs toggle/timezone state to open tabs

### Content Script

The content script:

- scans eligible text nodes on webpages
- detects time strings with timezone abbreviations
- asks the background script for conversions
- wraps matches with highlight badges
- watches dynamic DOM changes and rescans when needed

## Project Structure

```text
manifest.json
scripts/
  api.js
  background.js
  copyPasteConverter.js
  dom.js
  manageState.js
  popup.js
  storage.js
  tabs.js
  timeConversion.js
  timezoneDetectScript.js
  timezoneOffsets.js
  timezonePicker.js
  ui.js
HTML/
  popup.html
  instructions.html
CSS/
  popup.css
  instructions.css
images/
```

## Permissions

This extension currently uses the following google extension API's and permissions:

- `geolocation`: only when the user requests local timezone detection
- `storage`: for popup state, cached timezone data, and session cache
- `windows`: for the popup instructions/manual window
- `host_permissions` on `"<all_urls>"`: required for page scanning on arbitrary sites

It also requests access to:

- `https://timezone-proxy.albamartindarius.workers.dev/*`

This endpoint is used to:

- resolve latitude/longitude into timezone data
- retrieve the timezone list used by the dropdowns

## Privacy

- Page scanning is done locally in the content script.
- Detected page text is not sent to the timezone API.
- Only explicit timezone lookup requests and the optional location-based timezone lookup go through the proxy endpoint.
- Popup state and cached timezone data are stored in Chrome storage.

See [`privacy-policy.md`](./privacy-policy.md) for the full policy.

## Local Development

1. Clone or download this repository.
2. Go to google extensions at the top right of chrome, this is the icon with the puzzle piece
3. Click manage extensions.
4. At the very top-right side toggle developer mode.
5. A new button will appear on the top-left side of the screen, click on load unpacked.
6. Select the folder where you cloned the repository from.

After making changes:

- reload the extension from `chrome://extensions`
- refresh any already-open tabs if you changed the content script

## Usage

### Automatic Page Detection

1. Open the extension popup.
2. Click the location button to detect your local timezone.
3. Turn the page scanner toggle on.
4. Visit a normal webpage containing time strings.

Detected matches will be highlighted and annotated with local-time badges.
For more details, there is also an entitled intruction popup for time zone offsets in the popup itself.

### Paste & Convert

Supported formats include:

- `10:30 PM PST`
- `PST 10:30 PM`
- `10:30 a.m. EST`

### Manual Converter

1. Pick a source timezone.
2. Pick a target timezone.
3. Enter a time.
4. Convert from the popup.

## Notes

- Some timezone abbreviations are inherently ambiguous.
- Restricted pages such as `chrome://` and Chrome Web Store pages cannot be scanned.
- Existing tabs may need a refresh after reloading the extension during development.

## Status

This is an actively iterated personal project. The codebase currently focuses on:

- correctness for common timezone patterns
- local-first page scanning
- popup usability
- Chrome Extension Web Store readiness

## Contributing

Feedback, bug reports, feature suggestions, and pull requests are very much welcome and appreciated.

You can contribute by:
- opening an issue for bugs or edge cases
- suggesting improvements to detection logic or UI
- submitting pull requests for focused fixes or features

For larger changes, open an issue first so the direction is clear before implementation, thank you.
