# Past Space Apps winners: what worked and what we change

Research done 31 Oct 2026 (AI, Claude Code) for ninja. Planning input only: nothing about our product is designed or built here (prep rule, `docs/decisions.md`).

## Our situation, taken from the repo

- **Challenge:** Lunar Landing Site Navigator (badge "10 - CLPS"): "compare lunar south-pole landing sites and dates, visualizing Sun and Earth positions relative to the local horizon to assess solar power potential and direct-to-Earth communication windows" for mission planners, educators and the public ([README](../README.md), [challenge page](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/)).
- **Award category:** the repo does not name one, and the 2026 categories arrive with the Judging & Awards Guide on 13 Nov (`docs/decisions.md`, "Open questions"). The repo lists the 2025 award set. Our output is a tool that turns NASA lunar data into numbers, so the closest awards are **Best Use of Data**, **Best Use of Science** and **Best Use of Technology**. I gave first priority to winners in those three, and to winners of the lunar data visualisation challenge "Make a Moonquake Map" (2022) / "2.0" (2023), which is the closest past challenge to ours.
- **Constraints:** 4 school students (all under 18) with a school Betreuerin. About 29 build hours on site (Sat 10:30 → Sun 15:45 local deadline, submit by 15:00), with at least 6 h sleep each. Nothing built before Sat 09:00. Local judges pitch from 16:00, then the global funnel. The repo is private. Static JSON + static frontend.

## How judging works (official text)

Source: [Space Apps 2022 Judging & Awards Guide (PDF)](https://spaceapps-prod.s3.amazonaws.com/media/documents/Space_Apps_2022_Judging_and_Awards_Guide.pdf), pp. 6–9. This is the newest full guide I could open; the 2025 and 2026 guides on spaceappschallenge.org did not load (see "Limits"). A 2026 search snippet of the [current Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) lists the same five criteria.

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

The 2026 limits are unknown until 13 Nov.

## Winners table

All ten are Global Winners. Award, challenge and description come from NASA's own announcements:
- 2022: [Earthdata, 8 Dec 2022](https://www.earthdata.nasa.gov/news/nasa-announces-winners-2022-global-space-apps-challenge)
- 2023: [NASA Science, Dec 2023](https://science.nasa.gov/directorates/smd/2023-nasa-international-space-apps-challenge-announces-10-global-winners/)
- 2024: [NASA, 2024 winners](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-international-space-apps-challenge-announces-2024-global-winners/)
- 2025: [NASA, 18 Dec 2025](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-announces-2025-international-space-apps-challenge-global-winners/)

"Page read" means I opened the team's own project page or repo. Otherwise only NASA's short description was available.

| # | Year · award | Challenge | Team · project (source) | What they built | NASA data used | How presented | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | 2022 · Galactic Impact | Make a Moonquake Map! | Selene · *Moonquake Visualized* ([project page](https://2022.spaceappschallenge.org/challenges/2022-challenges/moonquake-map/teams/selene-5/project)) | Web app: pick year + day, and the moonquake shows as an animated wave sized by magnitude on a 3D Moon globe. Toggles for topography map, Apollo sites and lat/lon grid; first-person view in Unity | Apollo seismic event catalog (PDS Geosciences), NASA SVS CGI Moon Kit, LRO LOLA shaded relief, NASA 3D resources, IRIS PSE files, all linked on the page | Live hosted app + [YouTube demo](https://www.youtube.com/watch?v=IAwY9wcxcLQ) + GitHub; page states the gap filled: "we could not find any tool that can plot and visualize…"; lists "future implementation" openly | Page read |
| 2 | 2022 · Local Impact | Make a Moonquake Map! | Brute Force · *Moonquake Map* ([project page](https://2022.spaceappschallenge.org/challenges/2022-challenges/moonquake-map/teams/brute-force-5/project)) | Static site on GitHub Pages: "Timeline" tab (pick a date, see which Apollo stations transmitted, click for seismometer plots with max deviations), "Nakamura" tab (shallow moonquakes as ripples by magnitude) | Apollo PSE data scraped from NASA PDS, processed with Python/ObsPy; FDSN station info; Nakamura et al. 1979 catalog | [Live site](https://constantinosar.github.io/Moonquake-Map/) + [YouTube demo](https://www.youtube.com/watch?v=ukgGeVQY1Cc) + public repo; page names each script (`pse_fetch.py`, `pse_plot.py`, `nakamura_convert.py`) and each reference | Page read |
| 3 | 2023 · **Best Use of Science** | Make a Moonquake Map 2.0! | LunarTech Ensemble, Egypt ([project page](https://www.spaceappschallenge.org/2023/find-a-team/lunartech-ensemble/?tab=project)) | NASA: "a website and immersive game to help people understand and visualize the lunar seismic data gathered by instruments left behind during NASA's Apollo missions" | Apollo lunar seismic data | Probably the repo [yousefkotp/Lunar-Trek](https://github.com/yousefkotp/Lunar-Trek) ("official award-winning repository… Make a Moonquake Map 2.0!"): 3D globe with quake pins, time-series charts (Recharts), explainer on moonquakes vs earthquakes, UE5 game. README says an LLM feature was dropped "due to time constraints" | NASA text verified. Repo match **inferred**: the README does not name the team |
| 4 | 2023 · **Best Use of Technology** | Make a Moonquake Map 2.0! | Spacebee, US/Argentina ([project page](https://www.spaceappschallenge.org/2023/find-a-team/spacebee/?tab=project)) | NASA: "a website that integrates moonquake data … including the moonquake locations, type of moonquake, and date and data plots based on ALSEP Apollo experiments data" | ALSEP Apollo experiment data | Not verified (page did not load) | NASA text only; thin |
| 5 | 2024 · **Best Use of Science** | Create an Orrery Web App that Displays Near-Earth Objects | WMPGang · *SkyShield* ([project page](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/wmpgang/?tab=project)) | 3D orrery web app: real-time orbits of 1,669 NEOs, meteoroid streams and sporadic meteoroids, with filters. They went beyond the brief to show meteoroid risk to satellites and astronauts | NASA open NEO/orbit data (per [Western University news, Jan 2025](https://news.westernu.ca/2025/01/western-students-win-nasa-challenge-with-app-shows-risks-to-space-infrastructure/)) | [Hosted app](https://simonvse.com/projects/neo-orrery/app/). Team of physics grad students with no web experience, built in ~30 h. Team lead: "I thought it was a good idea to raise another important aspect – the potential risks of meteoroids. We thought it could be crucial to win." | NASA text + university article (secondary, quotes team) |
| 6 | 2024 · Best Mission Concept | Landsat Reflectance Data: On the Fly and at Your Fingertips | AsturExplorers, Spain · *Landsat Connect* ([project page](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/asturexplorers/?tab=project)) | NASA: web app to track Landsat satellites and access surface reflectance data, "set a target location and receive notifications when Landsat satellites pass over their area" | Landsat surface reflectance + orbit data | Not verified | NASA text only |
| 7 | 2025 · **Best Use of Technology** | Will It Rain on My Parade? | Twisters, Mexico · *SkySense* ([project page](https://www.spaceappschallenge.org/2025/find-a-team/twisters/?tab=project)) | NASA: web app with "ultra-local, personalized weather predictions… generating real-time risk assessments and suggesting the safest time windows for activities" | NASA Earth observation data | Not verified | NASA text only |
| 8 | 2025 · **Best Use of Science** | Build a Space Biology Knowledge Engine | SpaceGenes+, Germany ([project page](https://www.spaceappschallenge.org/2025/find-a-team/spacegenes/?tab=project)) | NASA: "interactive dashboard" so "researchers and mission planners" can identify molecular changes from radiation + microgravity | Space biology data (dataset not named by NASA) | Not verified | NASA text only; thin |
| 9 | 2022 · **Best Use of Data** | Take Flight (FIREX-AQ) | Starflock · ([project page](https://2022.spaceappschallenge.org/challenges/2022-challenges/take-flight/teams/starflock-3/project)) | Analysis of smoke chemistry (wildfire vs agricultural burns) to inform the public and farmers; phased plan | All 23 FIREX-AQ DC-8 flights, ~20 million rows, normalised before analysis | GitHub repo + [Google Slides demo](https://docs.google.com/presentation/d/1gt_6hwCpTVRXQCnGRerzhzYUWaX8EAeqvhPFEo4vGqI/edit?usp=sharing). Page explains data choice and processing step by step | Page read |
| 10 | 2024 · **Best Use of Data** | Leveraging Earth Observation Data for Informed Agricultural Decision-Making | GaamaRamma · *Waterwise* ([project page](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/gaamaramma/?tab=project)) | NASA: help "farmers efficiently manage water availability in the face of drought, pests, and disease" | Earth observation data (per challenge) | Not verified | NASA text only; thin |

**Contrast (did not win):** the 2022 challenge has many other Moonquake Map team pages ([challenge list](https://2022.spaceappschallenge.org/challenges/2022-challenges/moonquake-map)), for example "Moonquake visualizer" ([phycom-1](https://2022.spaceappschallenge.org/challenges/2022-challenges/moonquake-map/teams/phycom-1)). Search summaries say several of them also plotted quakes on a 3D Moon. I did not open those pages, so treat this as weak. It suggests a globe alone did not decide the award, and no source says what did.

**No judge reasoning was published for any of these ten.** NASA's announcements describe projects; they do not say why one beat another. Every "why" below is inference.

## Probably why they won (inference, tied to criteria)

- **Selene, Brute Force, LunarTech, Spacebee (lunar):** each turned an Apollo dataset that is hard to read into a site where you pick a date and see an answer (Relevance: usable; Best Use of Data: "makes space data accessible"). The pages read state the gap ("no tool…"), name every dataset and script (Validity), and ship a public live link + short demo (Presentation).
- **SkyShield (science):** domain experts made correct physics the centre and added one extra risk angle beyond the brief (Creativity + Validity). Their own quote says they chose the extra angle to win.
- **Landsat Connect, SkySense, SpaceGenes+:** each output answers a user's decision ("when does the satellite pass over me", "the safest time window", "which molecular changes matter for mission planners") rather than showing raw data (Impact + Relevance).
- **Starflock (data):** heavy, documented use of the full mission dataset, with the processing explained (Best Use of Data, Validity).

## Recurring patterns, ranked by evidence

| # | Pattern | Evidence | Strength |
|---|---|---|---|
| P1 | **Public, no-login live link + short demo, both working.** Every page I read had a hosted app or repo plus a separate video/slides demo. The 2022 rules require both to be public without registration, and judges stop at 30 s / 7 slides. | Official guide (rule) + 3/3 pages read (Selene, Brute Force, Starflock) | Strong |
| P2 | **Name every NASA dataset with a link, and say how it was processed.** All pages read list datasets, references and scripts. The guide requires a References field and lets NASA strip awards for missing citations (our `docs/decisions.md`). | Official guide + 3/3 pages read | Strong |
| P3 | **Pick a date/place → see the answer.** All four lunar winners centre on selecting a date (and place) and seeing the event on the Moon. Same-challenge winners went to Science, Technology, Galactic and Local Impact. | NASA text for 4/4 + 2 pages read | Strong for lunar data viz |
| P4 | **The output answers a decision for a named user, often one step past the brief.** Examples: pass alerts for my location, safest time windows, mission-planner dashboard, meteoroid risk. | NASA text for 4 winners + 1 team quote | Medium (descriptions, not judges' reasons) |
| P5 | **Valid science wins the science award, even with weak web skills.** SkyShield: physics grads, no web experience, "best and most valid use of science". | 1 winner with secondary source + award definition | Medium |
| P6 | **Presentation is weighted equally and needs an owner and time during the build.** | Official guide only (no winner-level evidence) | Strong as a rule, untested as a cause |
| P7 | **Honest scope: unfinished parts named, not hidden.** Selene's "future implementation"; Lunar Trek README admits the dropped LLM. The guide: "we do not expect you to have a completely finished… solution". | 2 winners + guide | Medium-weak |
| P8 | **Immersive extras (3D globe, game, first-person view).** Appear in 3 of 4 lunar winners, but also in many non-winners. | Same as P3 | Weak as a cause; **not adopted** (see below) |

## What is different about us

- **Our brief is a decision tool for mission planners, not outreach.** The Moonquake winners were exploration and outreach pieces. P3/P4 transfer (pick site + dates → power and comms windows); P8 does not. A game or 3D globe would cost hours we need for validated numbers. The sky plot already shows "what you'd see standing there".
- **About 29 h, minors, 6 h sleep each.** In 2022 the submission window ran from Sat 09:00 to Sun 23:59 local, about 39 h (2022 Submission Guide); SkyShield was built in about 30 h. We stop at Sun 15:45. We copy only cheap patterns: P1, P2, P6 and P7 cost hours, not features.
- **Validity is our hard part, and our edge.** Wrong horizon or Earth numbers would fail Validity outright (the 27 Oct tools run showed Horizons gives plausible wrong answers). P5 supports keeping S's gates exactly as they are.
- **The repo is private by rule (AGENTS.md).** If the 2026 guide repeats 2022's "public link to final project", we need a decision on what gets published. The hosted static app is public anyway; code is the open question for Isaac.
- **Local judging comes first.** Local judges pick the nominees from a live pitch plus the submission. The 2022 guide says the demo is often seen first, so the 30 s demo and the 16:00 pitch both matter.
- **2026 categories and limits are unknown until 13 Nov.** All format items below default to the 2022 rules and must be re-checked then.

## Limits of this research

- www.spaceappschallenge.org (2023–2026 pages, current guides) did not load on 31 Oct 2026: the TLS chain ends in a root that is not in this environment's trust store, and fetches returned HTTP 503. I did not bypass verification. The 2023–2025 project pages above are linked from NASA's announcements and I could not read them, so those rows are marked "NASA text only".
- The 2022 site (2022.spaceappschallenge.org) and the 2022 guides on S3 loaded and were read.
- No judges' reasoning exists in any source found. Patterns are correlations across 10 winners, not causes.
