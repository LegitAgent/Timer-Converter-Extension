# Privacy Policy — Time Converter Extension

Last updated: March 2026

## Overview

This Privacy Policy explains how Time Converter Extension handles data.

The extension is designed to:

- detect time strings on webpages
- convert those time strings into your local timezone
- provide manual and paste-based timezone conversion tools in the popup

The extension does not sell personal data, use advertising trackers, or require an account.

## What the Extension Can Access

The extension requests permission to run on webpages so it can detect visible time strings and show converted local-time badges beside them.

This means the extension may read page contents locally inside your browser in order to:

- scan text nodes for supported time-and-timezone formats
- highlight matching text
- display local-time badges

This page scanning happens locally on your device. Detected page text is not sent to the timezone API. The API simply gets user location based on latitude and longitude coordinates and in retrieving a list of available time zones.

## Location Data

The extension optionally requests access to your geographic location only when you explicitly use the location-detection feature in the popup.

If you choose to use this feature:

- your browser provides latitude and longitude to the extension
- those coordinates are sent to the timezone lookup proxy at `timezone-proxy.albamartindarius.workers.dev`
- the proxy returns timezone information such as timezone name and UTC offset

Your location is used only to determine your local timezone for conversion purposes.

The extension does not use your location for:

- advertising
- profiling
- tracking
- analytics

## Page Content

When the page scanning feature is enabled, the extension checks visible page text for supported time formats such as timezone abbreviations and time strings.

This processing is done locally in the content script running in your browser.

The extension does not send full webpage contents, browsing history, or arbitrary page text to the timezone API.

## Chrome Storage

The extension uses Chrome local and session storage to keep the extension usable between popup sessions.

This may include:

- your detected timezone data
- cached latitude and longitude for local timezone reuse
- popup state such as selected tabs and last-used inputs
- cached conversion outputs
- cached timezone list data
- whether page scanning is enabled

This storage stays inside Chrome extension storage on your device unless you separately use a browser profile feature that syncs extension data.

## External Services

The extension communicates with:

- `timezone-proxy.albamartindarius.workers.dev`

This service is used to:

- resolve coordinates into timezone information
- retrieve the timezone list used by the popup dropdowns

No account information is required.

Other than the optional location lookup and timezone list requests, the extension does not transmit personal information to external servers.

## What the Extension Does Not Do

The extension does not:

- sell your personal information
- use advertising SDKs
- track your browsing history for analytics or profiling
- require login credentials
- collect payment information
- send arbitrary webpage text to the timezone API for storage or analysis

## Data Retention

Data stored in Chrome storage remains there until:

- you clear the extension’s stored data
- you remove the extension
- cached values are replaced by newer values during normal use

## Changes to This Policy

This Privacy Policy may be updated if the extension’s features or data handling change. If that happens, the updated version will be reflected in this file.

## Contact

If you have questions about this Privacy Policy, you can contact:

- albamartindarius@gmail.com

or open an issue on the project repository.
