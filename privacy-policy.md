# Privacy Policy — Time Converter Extension
 
Last updated: March 2026
 
## Overview
 
This Privacy Policy describes how the Time Converter Extension handles your data. This extension is built for personal convenience and does not collect, store, or sell any personal information.
 
## Location Data
 
The extension optionally requests access to your geographic location (latitude and longitude) when you click the "Get My Timezone" button. This is used solely to determine your local time zone so you do not have to type it in manually.
 
Your coordinates are sent to a timezone lookup proxy (`timezone-proxy.albamartindarius.workers.dev`) to retrieve the corresponding time zone name and UTC offset. This third-party service returns only time zone information and does not store your location data.
 
**Important:** Location data is never stored on any external server, never sold, and never used for advertising, tracking, or any purpose beyond resolving your local time zone.
 
## Local Storage
 
The extension uses Chrome's local and session storage to remember your last-used settings, such as your detected time zone, selected input fields, and conversion results. This data never leaves your browser and is only used to restore the extension's state between sessions for your convenience.
 
## Third-Party Services
 
The extension communicates with the following external service:
 
**Timezone Lookup Proxy** — `timezone-proxy.albamartindarius.workers.dev`
 
Used to resolve geographic coordinates into a time zone name and UTC offset, and to retrieve the list of available time zones. No personally identifiable information is transmitted beyond the latitude and longitude you provide.
 
## What We Do Not Do
 
This extension does not:
 
- Collect or store your personal information
- Track your browsing activity
- Share your data with advertisers or third parties beyond the timezone lookup described above
- Require an account or login
- Use your location for any purpose other than timezone detection
 
## Contact
 
If you have any questions about this privacy policy, feel free to reach out via email at albamartindarius@gmail.com or open an issue on the extension's GitHub repository.