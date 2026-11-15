# Terms of use for the app — text approved by ninja (14 Nov 2026)

Status: AI draft, 14 Nov 2026; visible text below approved by ninja on 14 Nov 2026 (now in the app: `app/src/views/Terms.tsx`). Decided by ninja: short terms of use + disclaimer (no contract-style T&C); operator named by team name only, no personal names or address (submission rule: no recognizable names of anyone under 18); the UI wiring is done separately by the frontend owner. Not legal advice. Whether a German Impressum is required for this demo site has not been checked.

Facts checked for this draft (main `742ac84`): the app sets no cookies, uses no localStorage/sessionStorage/IndexedDB, loads no analytics or third-party scripts, and bundles its fonts; it is served as static files by a Cloudflare Worker on `nasa.digi-works.org` (`app/wrangler.jsonc`). Code licence: Apache 2.0 (`LICENSE`).

Proposed placement: a "Terms of use" link in the Details drawer next to the sources, opening the text below. No new header control.

---

## Terms of use

**Lunar Landing Site Navigator** is a student project by team SFZ | MEXG for the NASA Space Apps Challenge 2026 (local event Heilbronn).

**Not NASA.** This app is not made, endorsed or reviewed by NASA or ESA. It uses public NASA data; the use of that data does not imply endorsement.

**Not for real missions.** The app is a learning and exploration tool. Its results come from public data and our own calculations; some have been checked by team members, none are certified. Do not use them to plan, fly or make safety decisions for a real mission. Sunlight, Earth visibility, slope, shadow and temperature values have stated limits; where data is missing the app says "unknown".

**No warranty.** The app is provided as is, without any warranty. We are not liable for decisions made on the basis of its results, to the extent the law allows.

**Your privacy.** The app has no accounts and collects nothing about you: no cookies, no tracking, no analytics, nothing stored in your browser. Like any website, the hosting provider (Cloudflare) processes technical request data such as your IP address to deliver the pages.

**Data and credits.**
- Terrain: LRO LOLA, Barker et al. 2023 (doi:10.3847/PSJ/acf3e1; data doi:10.60903/gsfcpgda-lola-spole), NASA Goddard PGDA; LOLA 5 m polar map, NASA Planetary Data System.
- Sunlight and permanent shadow: LOLA average illumination maps, Mazarico et al. 2011 (doi:10.1016/j.icarus.2010.10.030), NASA PDS.
- Temperature: LRO Diviner Polar Resource Product, Paige et al., LRO-L-DLRE-5-PRP-V2.0, NASA PDS, 2018.
- Sun and Earth positions: NASA/JPL NAIF SPICE kernels.
- Moon and star imagery: NASA's Scientific Visualization Studio (CGI Moon Kit; Deep Star Maps 2020).
- Site coordinates and research facts: the source linked next to each value in the app.

Note for the UI owner: the drawer section "How this is computed" (main `742ac84`) lists the LOLA DEM and SPICE but not the illumination maps, Diviner or the SVS imagery; this text carries those credits until it does.

**AI use.** Parts of the code, data processing and text were written with AI coding assistants and checked by team members.

**Code licence.** The source code is open source under the Apache License 2.0. Third-party data keeps its own terms and citations.

**Contact.** Team SFZ | MEXG, via the NASA Space Apps Challenge 2026 project page.
