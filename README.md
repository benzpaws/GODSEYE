# GODS EYE // World Observatory

A browser-based 3D Earth observatory built with vanilla JavaScript, Three.js and satellite.js. It displays calculated satellite positions, reported aircraft positions, optional AIS vessel observations, public news headlines and operator-supplied camera feeds. The interface is designed as a cinematic spy simulator while labeling calculated, reported and unavailable data honestly.

## Current build

The main page is a clean three-panel observatory with animated target icons, smooth camera following, a solid Earth occlusion test, Natural/Recon/Night Vision views, aircraft and vessel layers, a news briefing panel and a camera-feed panel. Select an object from the list or click its icon on the globe. Objects behind the Earth are hidden from both the marker layer and the hit target.

The optional `server/` folder is the production path for provider-backed feeds. See [docs/FEED-SETUP.md](docs/FEED-SETUP.md) before connecting commercial data sources.

## What the positions mean

- **Aircraft:** OpenSky reports observations, not guaranteed current or complete coverage. The app accepts positions observed within the last 120 seconds and shows the observation time in UTC. When a refresh fails, the desktop view removes the previous aircraft snapshot instead of presenting it as live. The mobile view refreshes aircraft every 60 seconds and filters stale reports.
- **Satellites:** SGP4 estimates positions from CelesTrak orbital elements. These are calculations, not direct live measurements. The desktop dossier displays the element epoch. If the catalog cannot be fetched, the app shows satellites offline; the bundled old sample elements are not used as current positions.
- **Military:** The optional ADS-B Exchange feed requires a separately configured key and browser access permitted by that provider. Without that feed, callsign matches are hints only; the UI labels them as possible. An absent match does not establish that an aircraft is civilian.
- **Radar:** Aircraft contacts are filtered to recent observations. A satellite in the radar's circle has a nearby ground projection; the display does not establish direct visibility above the horizon.

There is currently no authoritative historical tracking, comprehensive worldwide aircraft coverage, provider redundancy or dependable offline cache. Some layers depend on third-party CORS behavior and a public proxy. The project does not infer positions excluded from public feeds.

## Run locally

Serve the repository from a local HTTP server, for example `python3 -m http.server 8000`, then open `http://localhost:8000/`. GitHub Pages serves the same static files. The desktop page is `app.html`; the mobile radar is `mobile.html`.

The login is a **public cinematic UI gate**, with published demo credentials `Benzpaws` / `Benzpaws9`. A client-side hash and localStorage session do not protect the source or data. Do not put secrets in any file deployed to GitHub Pages.

To try optional integrations on a private local deployment, copy `src/config.local.example.js` to `src/config.local.js` and edit the copy. That file is ignored by Git, but if you publish it with a static site its contents become public. Optional API credentials are not required for the core free-data experience. Never send a key through a public CORS proxy.

## Data and dependencies

- CelesTrak GP data (TLE format) for satellite elements; satellite.js 4.1.4 for propagation.
- OpenSky Network states for aircraft positions; a third-party CORS proxy is currently used for browser requests. Provider availability and usage policies apply.
- Optional ADS-B Exchange and AviationStack integrations require your own credentials and compatible browser access; these are not core dependencies.
- Three.js r128 and satellite.js load from public CDNs. Earth imagery loads from externally hosted sources.

The interface includes search, selection, telemetry, orbit trails, world clock, radar, visual filters and a mobile-specific view. Desktop and mobile do not yet have feature parity.

## Security and contribution status

An API key was previously committed in `src/config.local.js`. Its owner must revoke and replace it; deleting the file in a later commit does not erase Git history. Client-side integrations cannot keep API keys secret.

The source is publicly viewable, but no open-source license has been selected yet. Please obtain the owner's license decision before redistributing or accepting outside contributions.
