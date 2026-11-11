# Past Space Apps winners: what worked and what we change

Research done 31 Oct 2026 (AI, Claude Code) for ninja. Planning input only: nothing about our product is designed or built here (prep rule, `docs/reference/decisions.md`).

## Our situation, taken from the repo

- **Challenge:** Lunar Landing Site Navigator (badge "10 - CLPS"): "compare lunar south-pole landing sites and dates, visualizing Sun and Earth positions relative to the local horizon to assess solar power potential and direct-to-Earth communication windows" for mission planners, educators and the public ([README](../../README.md), [challenge page](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/)).
- **Award category:** the repo does not name one, and the 2026 categories arrive with the Judging & Awards Guide on 13 Nov (`docs/reference/decisions.md`, "Open questions"). The repo lists the 2025 award set. Our output is a tool that turns NASA lunar data into numbers, so the closest awards are **Best Use of Data**, **Best Use of Science** and **Best Use of Technology**. I gave first priority to winners in those three, and to winners of the lunar data visualisation challenge "Make a Moonquake Map" (2022) / "2.0" (2023), which is the closest past challenge to ours.
- **Constraints:** 4 school students (all under 18) with a school Betreuerin. About 29 build hours on site (Sat 10:30 → Sun 15:45 local deadline, submit by 15:00), with at least 6 h sleep each. Nothing built before Sat 09:00. Local judges pitch from 16:00, then the global funnel. The repo is private. Static JSON + static frontend.

## How judging works (official text)

Source: [Space Apps 2022 Judging & Awards Guide (PDF)](https://spaceapps-prod.s3.amazonaws.com/media/documents/Space_Apps_2022_Judging_and_Awards_Guide.pdf), pp. 6–9. This is the newest full guide read. The 2026 guides are due 13 Nov (`docs/reference/decisions.md`). An earlier search snippet of the [Project Submission Guide URL](https://www.spaceappschallenge.org/resources/project-submission-guide/) listed the same five criteria, but that page returned "Page Not Found" on 31 Oct, so treat this as unconfirmed.

| Criterion | Official wording (2022) |
|---|---|
| Impact | "How much impact (quality and quantity) can this project have? … Will it inspire or help many, or a few?" |
| Creativity | "Is the project novel … or is it an incremental improvement on something that already exists?" |
| Validity | "Is the solution scientifically valid? Will it do what it sets out to do? Can it work in the real world?" |
| Relevance | "Is this project responsive to the challenge …? Is it a complete solution …? How usable or user friendly is the solution?" |
| Presentation | "How well did the team communicate their project? … the challenge, the solution, and why is it important?" Guide: "pay equal attention to the final criterion: presentation." |

Award definitions from the same guide: **Best Use of Data**: "best makes space data accessible, or leverages it to a unique application". **Best Use of Science**: "best and most valid use of science and/or the scientific method". **Best Use of Technology**: "most innovative use of technology".

Process: local judges select which projects advance as Global Nominees and may give local prizes. NASA and partner experts then pick Global Finalists, and an executive committee picks one winner per award.

Submission rules in the [2022 Project Submission Guide (PDF)](https://spaceapps-prod.s3.amazonaws.com/media/documents/Space_Apps_2022_Project_Submission_Guide.pdf), pp. 6–13, verified, 2022 only:
- The Final Project link and the Demo link must be "publicly accessible (i.e. access should not require permission or registration)".
- The Demo is a video of up to 30 s or slides of up to 7. "The judges will stop reviewing the Demos once they reach either 30 seconds … or 7 slides."
- The Demo "is often the first part of your submission that is reviewed by the judges".
- The guide advises: "Consider tasking one teammate to take charge of the Demo" and "build in time for creating the Demo" during the hackathon. Its "30 Seconds of Glory" template aims at "someone who has no context, technical background, or previous knowledge".

Winner demos fit this limit, including after 2022: of the 7 winners with YouTube demos (2022–2024), 6 run 27–31 s (Selene, Brute Force, LunarTech, Spacebee, AsturExplorers, GaamaRamma) and one runs 93 s (WMPGang). Runtimes read from YouTube on 31 Oct. The 2025 demos on Google Drive and Starflock's slides were not measured.

The 2026 limits are unknown until 13 Nov.

## Winners table

All ten are Global Winners. Award and challenge come from NASA's own announcements:
- 2022: [Earthdata, 8 Dec 2022](https://www.earthdata.nasa.gov/news/nasa-announces-winners-2022-global-space-apps-challenge)
- 2023: [NASA Science, Dec 2023](https://science.nasa.gov/directorates/smd/2023-nasa-international-space-apps-challenge-announces-10-global-winners/)
- 2024: [NASA, 2024 winners](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-international-space-apps-challenge-announces-2024-global-winners/)
- 2025: [NASA, 18 Dec 2025](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-announces-2025-international-space-apps-challenge-global-winners/)

"Page read" means the team's own project page was opened and read. All ten were. The live apps and Drive demos they link to were not opened or tested. Descriptions are the teams' own claims.

| # | Year · award | Challenge | Team · project (source) | What they built | NASA data used | How presented | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | 2022 · Galactic Impact | Make a Moonquake Map! | Selene · *Moonquake Visualized* ([project page](https://2022.spaceappschallenge.org/challenges/2022-challenges/moonquake-map/teams/selene-5/project)) | Web app: pick year + day, and the moonquake shows as an animated wave sized by magnitude on a 3D Moon globe. Toggles for topography map, Apollo sites and lat/lon grid; first-person view in Unity | Apollo seismic event catalog (PDS Geosciences), NASA SVS CGI Moon Kit, LRO LOLA shaded relief, NASA 3D resources, IRIS PSE files, all linked on the page | Live hosted app + [30 s YouTube demo](https://www.youtube.com/watch?v=IAwY9wcxcLQ) + GitHub; page states the gap filled: "we could not find any tool that can plot and visualize…"; lists "future implementation" openly | Page read |
| 2 | 2022 · Local Impact | Make a Moonquake Map! | Brute Force · *Moonquake Map* ([project page](https://2022.spaceappschallenge.org/challenges/2022-challenges/moonquake-map/teams/brute-force-5/project)) | Static site on GitHub Pages: "Timeline" tab (pick a date, see which Apollo stations transmitted, click for seismometer plots with max deviations), "Nakamura" tab (shallow moonquakes as ripples by magnitude) | Apollo PSE data scraped from NASA PDS, processed with Python/ObsPy; FDSN station info; Nakamura et al. 1979 catalog | [Live site](https://constantinosar.github.io/Moonquake-Map/) + [30 s YouTube demo](https://www.youtube.com/watch?v=ukgGeVQY1Cc) + public repo; page names each script (`pse_fetch.py`, `pse_plot.py`, `nakamura_convert.py`) and each reference | Page read |
| 3 | 2023 · **Best Use of Science** | Make a Moonquake Map 2.0! | LunarTech Ensemble, Egypt · *Lunar Trek* ([project page](https://www.spaceappschallenge.org/2023/find-a-team/lunartech-ensemble/?tab=project)) | Website with a 3D Moon globe (quakes as pins), time-series analysis, moonquake vs earthquake explainer; Unreal Engine 5 game on the lunar surface | Apollo seismic data; page lists sources by name | [Live site](https://mohammadhelaly.github.io/lunar-trek/) + [27 s YouTube demo](https://youtu.be/J3z1jt0I5_A). Page says a planned LLM feature was not integrated "due to time constraints" | Page read |
| 4 | 2023 · **Best Use of Technology** | Make a Moonquake Map 2.0! | Spacebee, US/Argentina · *Aónikenk* ([project page](https://www.spaceappschallenge.org/2023/find-a-team/spacebee/?tab=project)) | Web app with a 3D Moon globe (globe.gl), date filter for Apollo-era events, animated seismic waves, time-series plots, landing sites, topographic/geological/temperature views. Extras: GPT chatbot, text-to-speech, AR version, Unity simulator | ALSEP/EASEP passive seismic data, PDART expanded event catalog, Apollo landing site coordinates; Diviner and LRO LOLA also listed | [Live app](https://aonikenk.spacebeetech.com/) + [30 s YouTube demo](https://youtu.be/vygmcA93Rnk) + [public repo](https://github.com/spacebee-technologies/Moonquakes-SpaceApps2023) | Page read |
| 5 | 2024 · **Best Use of Science** | Create an Orrery Web App that Displays Near-Earth Objects | WMPGang · *SkyShield* ([project page](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/wmpgang/?tab=project)) | 3D orrery web app: real-time orbits of 1,669 NEOs, meteoroid streams and sporadic meteoroids, with filters. They went beyond the brief to show meteoroid risk to satellites | NEO risk list and NEO downloads, stream shower data, planet and parent-body data, as listed on the page. Python preprocessing | [Hosted app](https://simonvse.com/projects/neo-orrery/app/) + [93 s YouTube demo](https://youtu.be/RBl_3ZsmVFo). Team specialises in meteors, per the page; no web experience and ~30 h, per [Western University news, Jan 2025](https://news.westernu.ca/2025/01/western-students-win-nasa-challenge-with-app-shows-risks-to-space-infrastructure/), which also quotes the lead saying the meteoroid angle "could be crucial to win" | Page read + university article (secondary) |
| 6 | 2024 · Best Mission Concept | Landsat Reflectance Data: On the Fly and at Your Fingertips | AsturExplorers, Spain · *Landsat Connect* ([project page](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/asturexplorers/?tab=project)) | Web app design: pin a location, get notified before a Landsat pass, then view and export surface reflectance data. Three named use cases (farmers, researchers, planners) | LandsatLook, EarthExplorer, Landsat Acquisition Tool, as listed on the page | Project link is a [Figma design](https://www.figma.com/design/IwJu33JEMEXTWvajOUClgQ/NASA-SpaceApps), not a hosted app, + [30 s YouTube demo](https://youtu.be/hipj00EOSDI) | Page read |
| 7 | 2025 · **Best Use of Technology** | Will It Rain on My Parade? | Twisters, Mexico · *SkySense* ([project page](https://www.spaceappschallenge.org/2025/find-a-team/twisters/?tab=project)) | Web app: personal weather predictions, risk assessments and the safest time windows for an activity, plus a Gemini assistant. Page lists Google sign-in | NASA POWER API and POWER Data Access Viewer; also Open-Meteo | [Live app](https://skysense.surf/) + demo on Google Drive. Page has a detailed AI-use statement | Page read |
| 8 | 2025 · **Best Use of Science** | Build a Space Biology Knowledge Engine | SpaceGenes+, Germany ([project page](https://www.spaceappschallenge.org/2025/find-a-team/spacegenes/?tab=project)) | Dashboard flagging genes whose response to radiation + microgravity combined exceeds the sum of each alone. States the gap: most tools treat these stressors separately. Filters described as future work | One NASA GeneLab dataset (OSD-288 / GLDS-288), with synergy scores computed in Python | [Framer site](https://spacegenes-plus.framer.website/) + demo on Google Drive; built with no-code and AI tools, per the page | Page read |
| 9 | 2022 · **Best Use of Data** | Take Flight (FIREX-AQ) | Starflock · ([project page](https://2022.spaceappschallenge.org/challenges/2022-challenges/take-flight/teams/starflock-3/project)) | Analysis of smoke chemistry (wildfire vs agricultural burns) to inform the public and farmers; phased plan | All 23 FIREX-AQ DC-8 flights, ~20 million rows, normalised before analysis | GitHub repo + [Google Slides demo](https://docs.google.com/presentation/d/1gt_6hwCpTVRXQCnGRerzhzYUWaX8EAeqvhPFEo4vGqI/edit?usp=sharing). Page explains data choice and processing step by step | Page read |
| 10 | 2024 · **Best Use of Data** | Leveraging Earth Observation Data for Informed Agricultural Decision-Making | GaamaRamma · *WaterWise* ([project page](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/gaamaramma/?tab=project)) | Web app: farmers map fields and enter crop details, then get a personal 7-day irrigation schedule and plain "Hydrated"/"Dehydrated" labels, plus a GPT chatbot. Page says it focuses on actions rather than raw numbers | OpenET evapotranspiration data, Earthdata Search, as listed on the page | [Live app](https://nasa-hackathon-2024-nine.vercel.app/) + [31 s YouTube demo](https://www.youtube.com/watch?v=Wg-gE3kYaas) | Page read |

**Contrast (did not win):** the 2022 challenge has many other Moonquake Map team pages ([challenge list](https://2022.spaceappschallenge.org/challenges/2022-challenges/moonquake-map)), for example "Moonquake visualizer" ([phycom-1](https://2022.spaceappschallenge.org/challenges/2022-challenges/moonquake-map/teams/phycom-1)). Search summaries say several of them also plotted quakes on a 3D Moon. I did not open those pages, so treat this as weak. It suggests a globe alone did not decide the award, and no source says what did.

**No judge reasoning was published for any of these ten.** NASA's announcements describe projects; they do not say why one beat another. Every "why" below is inference.

## Probably why they won (inference, tied to criteria)

- **Selene, Brute Force, LunarTech, Spacebee (lunar):** each turned an Apollo dataset that is hard to read into a site where you explore events by date (Relevance: usable; Best Use of Data: "makes space data accessible"). All four name their data and ship a hosted site + short demo (Validity, Presentation). Selene also states the gap directly ("no tool…"), and Brute Force names each script.
- **SkyShield (science):** domain experts made correct physics the centre and added one extra risk angle beyond the brief (Creativity + Validity). Their own quote says they chose the extra angle to win.
- **Landsat Connect, SkySense, SpaceGenes+, WaterWise:** each output answers a user's decision (when the satellite passes over me, the safest time window, which genes to prioritise, how much to irrigate this week) rather than showing raw data (Impact + Relevance). Landsat Connect won with a Figma design, so a concept can win Best Mission Concept without a hosted build. That does not transfer to a Validity-heavy tool like ours.
- **Starflock (data):** heavy, documented use of the full mission dataset, with the processing explained (Best Use of Data, Validity).

## Recurring patterns, ranked by evidence

| # | Pattern | Evidence | Strength |
|---|---|---|---|
| P1 | **Public project link + short demo.** All 10 pages list a project link and a separate video or slides demo. 6 of the 7 YouTube demos run 27–31 s. The 2022 rules require both to be public without registration, and judges stop at 30 s / 7 slides. | Official guide (rule) + 10/10 pages + measured runtimes. Links listed, not tested | Strong |
| P2 | **Name every NASA dataset and say what was done with it.** All 10 pages name their data; depth varies from named scripts and processing (Brute Force, Starflock) to a bare list (LunarTech). The guide requires a References field and lets NASA strip awards for missing citations (our `docs/reference/decisions.md`). | Official guide + 10/10 pages | Strong |
| P3 | **Pick a date/place → see the answer.** Selene, Brute Force and Spacebee select by date. LunarTech shows each quake's date and a time series, but its page does not describe a date picker. Same-challenge winners went to Science, Technology, Galactic and Local Impact. | 4 pages read: 3 clear, 1 partial | Medium-strong for lunar data viz |
| P4 | **The output answers a decision for a named user, often one step past the brief.** Examples: pass alerts for my location, safest time windows, gene priorities, a 7-day irrigation schedule, meteoroid risk. | 5 pages read + 1 team quote | Medium-strong (team descriptions, not judges' reasons) |
| P5 | **Valid science wins the science award, even with weak web skills.** SkyShield: meteor specialists, no web experience, "best and most valid use of science". | 1 winner, page + secondary source, + award definition | Medium |
| P6 | **Presentation is weighted equally and needs an owner and time during the build.** | Official guide; the demo runtimes in P1 fit it but do not show it caused a win | Strong as a rule, untested as a cause |
| P7 | **Honest scope: unfinished parts named, not hidden.** Selene's "future implementation"; Lunar Trek's page admits the dropped LLM; SpaceGenes+ marks filters as future work. The guide: "we do not expect you to have a completely finished… solution". | 3 winners + guide | Medium |
| P8 | **Immersive extras (3D globe, game, first-person view).** A 3D globe appears in 3 of 4 lunar winners (Selene, LunarTech, Spacebee), and search summaries suggest non-winners had one too. Brute Force won without one. | 4 pages read; non-winner evidence weak | Weak as a cause; **not adopted** (see below) |
| P9 | **AI chatbot on top of the data.** Spacebee, SkySense and WaterWise have one; LunarTech planned one and dropped it. | 4 pages read; other pages not checked for this | Weak as a cause; **not adopted**: a chatbot could state numbers S has not validated |

## What is different about us

- **Our brief is a decision tool for mission planners, not outreach.** The Moonquake winners were exploration and outreach pieces. P3/P4 transfer (pick site + dates → power and comms windows); P8 does not. A game or 3D globe would cost hours we need for validated numbers. The sky plot already shows "what you'd see standing there".
- **About 29 h, minors, 6 h sleep each.** In 2022 the submission window ran from Sat 09:00 to Sun 23:59 local, about 39 h (2022 Submission Guide); SkyShield was built in about 30 h. We stop at Sun 15:45. We copy only cheap patterns: P1, P2, P6 and P7 cost hours, not features.
- **Validity is our hard part, and our edge.** Wrong horizon or Earth numbers would fail Validity outright (the 27 Oct tools run showed Horizons gives plausible wrong answers). P5 supports keeping S's gates exactly as they are.
- **The repo is private by rule (AGENTS.md).** If the 2026 guide repeats 2022's "public link to final project", we need a decision on what gets published. The hosted static app is public anyway; code is the open question for Isaac.
- **Local judging comes first.** Local judges pick the nominees from a live pitch plus the submission. The 2022 guide says the demo is often seen first, so the 30 s demo and the 16:00 pitch both matter.
- **2026 categories and limits are unknown until 13 Nov.** All format items below default to the 2022 rules and must be re-checked then.

## Limits of this research

- All 10 project pages were read on 31 Oct 2026. Pages for 2023–2025 failed from a cloud environment and were read later in a desktop browser. The team's linked apps, Drive videos and repos were not opened, except that YouTube runtimes were read.
- The newest rules read are from 2022. The 2023–2025 guides were not read, and the 2026 guides are due 13 Nov.
- No judges' reasoning exists in any source found. Patterns are correlations across 10 winners, not causes, and 10 winners from different challenges is a small sample.
